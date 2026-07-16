/* eslint-disable @typescript-eslint/no-explicit-any -- row mappers take dynamically-shaped
   postgres rows (camelCased); typing each as `any` is the established asker/repo boundary idiom. */
import { sql } from '../db'
import type {
  Plan, PlanOption, PlanPick, PlanVenue, PublicPlan, PublicPlanOption, PublicViewer,
} from './types'

// Plan-coordination domain logic (growth-story Phase 1). Transport-agnostic — NO SMS. The strike
// (recordAvailabilityAndMaybeStrike) is ported from asker.repo.replyAndMaybeStrike: a FOR UPDATE on
// the plan row serializes concurrent picks so the plan strikes exactly once. Selection is framed as
// availability (C1-C hybrid), never RSVP; there is no decline path and absence is never recorded.

// ---- mapping helpers (postgres.camel gives camelCase keys; bigint comes back as string) ----
const toPlan = (r: any): Plan => ({
  id: r.id, token: r.token, creatorParticipantId: r.creatorParticipantId,
  intentText: r.intentText, context: r.context ?? null, state: r.state,
  confirmThreshold: r.confirmThreshold, struckOptionId: r.struckOptionId ?? null,
  version: String(r.version), createdAt: r.createdAt, closesAt: r.closesAt ?? null,
})
const toOption = (r: any): PlanOption => ({
  id: r.id, planId: r.planId, kind: r.kind, startsAt: r.startsAt ?? null,
  venue: (r.venue ?? null) as PlanVenue | null, label: r.label, aiRank: r.aiRank,
  aiRationale: r.aiRationale ?? null, source: r.source, createdAt: r.createdAt,
})

// ---- create / publish ----

export type NewPlan = {
  token: string
  creatorParticipantId: string
  intentText: string
  context?: unknown
  confirmThreshold?: number
  closesAt?: Date | null
}

export async function createPlan(p: NewPlan): Promise<Plan> {
  const [row] = await sql()`
    insert into pulse.plans (token, creator_participant_id, intent_text, context, confirm_threshold, closes_at)
    values (${p.token}, ${p.creatorParticipantId}, ${p.intentText},
            ${p.context ? sql().json(p.context as any) : null},
            ${p.confirmThreshold ?? 2}, ${p.closesAt ?? null})
    returning *`
  return toPlan(row)
}

export type NewOption = {
  kind: PlanOption['kind']
  label: string
  startsAt?: Date | null
  venue?: PlanVenue | null
  aiRank?: number
  aiRationale?: string | null
  source?: 'ai' | 'opener'
}

/** Replace the plan's options with a fresh set (proposing state only — options are provisional
 *  until the opener publishes). Idempotent re-propose: clears prior rows first. */
export async function setOptions(planId: string, options: NewOption[]): Promise<PlanOption[]> {
  return sql().begin(async (tx) => {
    await tx`delete from pulse.plan_options where plan_id = ${planId}`
    const out: PlanOption[] = []
    for (let i = 0; i < options.length; i++) {
      const o = options[i]!
      const [row] = await tx`
        insert into pulse.plan_options (plan_id, kind, starts_at, venue, label, ai_rank, ai_rationale, source)
        values (${planId}, ${o.kind}, ${o.startsAt ?? null},
                ${o.venue ? tx.json(o.venue as any) : null}, ${o.label},
                ${o.aiRank ?? i}, ${o.aiRationale ?? null}, ${o.source ?? 'ai'})
        returning *`
      out.push(toOption(row))
    }
    return out
  }) as Promise<PlanOption[]>
}

/** Opener publishes: proposing -> open, minting the shareable link. Only the creator may publish,
 *  and only from `proposing`. Returns the updated plan, or null if not permitted. */
export async function publishPlan(planId: string, participantId: string): Promise<Plan | null> {
  const [row] = await sql()`
    update pulse.plans set state = 'open', version = version + 1
    where id = ${planId} and creator_participant_id = ${participantId} and state = 'proposing'
    returning *`
  return row ? toPlan(row) : null
}

// ---- reads ----

export async function getPlanByToken(token: string): Promise<Plan | null> {
  const [row] = await sql()`select * from pulse.plans where token = ${token}`
  return row ? toPlan(row) : null
}

export async function getPlanById(id: string): Promise<Plan | null> {
  const [row] = await sql()`select * from pulse.plans where id = ${id}`
  return row ? toPlan(row) : null
}

export async function optionsForPlan(planId: string): Promise<PlanOption[]> {
  const rows = await sql()`
    select * from pulse.plan_options where plan_id = ${planId} order by ai_rank, created_at`
  return rows.map(toOption)
}

/** availableCount per option id (distinct invitees who marked availability). */
export async function pickCounts(planId: string): Promise<Map<string, number>> {
  const rows = await sql()`
    select option_id, count(*)::int as n from pulse.plan_picks where plan_id = ${planId} group by option_id`
  return new Map(rows.map((r: any) => [r.optionId as string, r.n as number]))
}

/** The option ids the viewer has marked available for. */
export async function myPicks(planId: string, participantId: string): Promise<Set<string>> {
  const rows = await sql()`
    select option_id from pulse.plan_picks where plan_id = ${planId} and participant_id = ${participantId}`
  return new Set(rows.map((r: any) => r.optionId as string))
}

// ---- the strike (ported from asker.replyAndMaybeStrike) ----

export type PickResult =
  | { kind: 'closed' }
  | { kind: 'invalid' }
  | { kind: 'recorded' }
  | { kind: 'struck'; winnerOptionId: string }

/** Record one invitee's availability for an option; strike the plan if that option reaches the
 *  confirmation threshold. FOR UPDATE on the plan row serializes concurrent threshold-crossing
 *  picks so the plan strikes exactly once on exactly one winning option. */
export async function recordAvailabilityAndMaybeStrike(
  planId: string, optionId: string, participantId: string, now: Date,
): Promise<PickResult> {
  return sql().begin(async (tx) => {
    const [plan] = await tx`select * from pulse.plans where id = ${planId} for update`
    if (!plan || plan.state !== 'open') return { kind: 'closed' as const }
    if (plan.closesAt && new Date(plan.closesAt).getTime() <= now.getTime()) return { kind: 'closed' as const }
    // The option must belong to this plan (guard against a forged/foreign option id).
    const [opt] = await tx`select id from pulse.plan_options where id = ${optionId} and plan_id = ${planId}`
    if (!opt) return { kind: 'invalid' as const }
    await tx`
      insert into pulse.plan_picks (plan_id, option_id, participant_id)
      values (${planId}, ${optionId}, ${participantId})
      on conflict (option_id, participant_id) do nothing`
    // Bump version on every pick so link-view pollers refresh the availability counts.
    await tx`update pulse.plans set version = version + 1 where id = ${planId}`
    const [{ n }] = await tx`
      select count(*)::int as n from pulse.plan_picks where option_id = ${optionId}`
    if (n < plan.confirmThreshold) return { kind: 'recorded' as const }
    await tx`
      update pulse.plans set state = 'struck', struck_option_id = ${optionId}, version = version + 1
      where id = ${planId} and state = 'open'`
    return { kind: 'struck' as const, winnerOptionId: optionId as string }
  }) as Promise<PickResult>
}

// ---- serialize (the ONLY plan shape sent to the client; creator id, picker ids never leak) ----

export function toPublicPlanOption(
  o: PlanOption, counts: Map<string, number>, mine: Set<string>, winnerId: string | null,
): PublicPlanOption {
  return {
    id: o.id, kind: o.kind, label: o.label,
    startsAt: o.startsAt ? o.startsAt.toISOString() : null,
    venue: o.venue, aiRationale: o.aiRationale,
    availableCount: counts.get(o.id) ?? 0,
    mine: mine.has(o.id),
    won: winnerId === o.id,
  }
}

export function toPublicPlan(
  plan: Plan, creatorName: string | null, options: PlanOption[],
  counts: Map<string, number>, mine: Set<string>, viewer: PublicViewer,
): PublicPlan {
  const pub = options.map((o) => toPublicPlanOption(o, counts, mine, plan.struckOptionId))
  return {
    token: plan.token,
    intentText: plan.intentText,
    creatorName,
    state: plan.state,
    options: pub,
    struck: plan.state === 'struck',
    winner: pub.find((o) => o.won) ?? null,
    viewer,
  }
}

/** Assemble the client-facing PublicPlan for a token (options + availability counts + the viewer's
 *  own marks + the creator's name). The ONLY plan shape a route/page sends to the client. */
export async function getPublicPlanByToken(token: string, viewer: PublicViewer): Promise<PublicPlan | null> {
  const plan = await getPlanByToken(token)
  if (!plan) return null
  const [options, counts] = await Promise.all([optionsForPlan(plan.id), pickCounts(plan.id)])
  const mine = viewer ? await myPicks(plan.id, viewer.participantId) : new Set<string>()
  const [creator] = await sql()`
    select display_name from pulse.participants where id = ${plan.creatorParticipantId}`
  return toPublicPlan(plan, (creator as any)?.displayName ?? null, options, counts, mine, viewer)
}

// Row type re-export so tests/routes can reference the pick row without a second import site.
export type { PlanPick }

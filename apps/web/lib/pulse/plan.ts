/* eslint-disable @typescript-eslint/no-explicit-any -- row mappers take dynamically-shaped
   postgres rows (camelCased); typing each as `any` is the established asker/repo boundary idiom. */
import { sql } from '../db'
import { emberTapsForPlans, publicEmberFromTaps } from './ember'
import type {
  Plan, PlanOption, PlanPick, PlanVenue, PublicDashPlan, PublicPlan, PublicPlanOption, PublicViewer,
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
  struckAt: r.struckAt ?? null,
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
      update pulse.plans
      set state = 'struck', struck_option_id = ${optionId}, struck_at = ${now}, version = version + 1
      where id = ${planId} and state = 'open'`
    return { kind: 'struck' as const, winnerOptionId: optionId as string }
  }) as Promise<PickResult>
}

// ---- lazy lifecycle transitions (close-plan-loop) ----

/** A struck plan completes once its winning time + this buffer has passed — the gathering has
 *  plausibly ended and warmth is at peak (never "do this again?" mid-dinner). Constant, not config. */
export const COMPLETE_BUFFER_MS = 4 * 3600_000
/** Fallback when the winning option carries no parseable time: complete 24h after the strike. */
export const TIMELESS_COMPLETE_MS = 24 * 3600_000

/** The deadline winner: most availability, tie -> earliest start (timeless options last),
 *  still tied -> lowest option rank. Null when nothing was marked anywhere (-> expired). */
export function pickDeadlineWinner(options: PlanOption[], counts: Map<string, number>): PlanOption | null {
  const marked = options.filter((o) => (counts.get(o.id) ?? 0) > 0)
  if (marked.length === 0) return null
  return marked.reduce((best, o) => {
    const bn = counts.get(best.id) ?? 0, on = counts.get(o.id) ?? 0
    if (on !== bn) return on > bn ? o : best
    const bt = best.startsAt ? best.startsAt.getTime() : Infinity
    const ot = o.startsAt ? o.startsAt.getTime() : Infinity
    if (ot !== bt) return ot < bt ? o : best
    return o.aiRank < best.aiRank ? o : best
  })
}

/** Apply any due lifecycle transition, lazily, on read (design D1: no cron — polling clients make
 *  reads frequent, and nothing must happen at an exact moment). Two transitions:
 *    open   past closes_at            -> auto-strike the best option, or expired when nobody marked
 *    struck past the gathering (D3)   -> completed
 *  Each is a conditional single-statement update (`… where state = 'x'`), the same idempotent
 *  pattern as the threshold strike: two racing readers -> one transition, the loser's update
 *  matches zero rows and its re-read returns the winner's result. */
export async function resolvePlanState(plan: Plan, now: Date): Promise<Plan> {
  // Fetch only what the due transition needs; the state math lives in resolvePlanStateWith so the
  // dash batch path (pre-fetched options/counts) and this per-plan path cannot diverge.
  // Sequential on purpose: the local PGlite harness serializes one backend session (see
  // plan.test.ts concurrency note) and two racing reads here would interleave the protocol.
  const needsOptions =
    (plan.state === 'open' && plan.closesAt && plan.closesAt.getTime() <= now.getTime()) ||
    (plan.state === 'struck' && plan.struckOptionId)
  const options = needsOptions ? await optionsForPlan(plan.id) : []
  const counts = plan.state === 'open' && needsOptions ? await pickCounts(plan.id) : new Map<string, number>()
  return resolvePlanStateWith(plan, now, options, counts)
}

/** resolvePlanState against pre-fetched options + pick counts (no reads unless a transition
 *  actually fires, and then only the conditional update + one re-read). */
export async function resolvePlanStateWith(
  plan: Plan, now: Date, options: PlanOption[], counts: Map<string, number>,
): Promise<Plan> {
  // Deadline resolves the plan instead of killing it (D2). `expired` now means nobody engaged.
  if (plan.state === 'open' && plan.closesAt && plan.closesAt.getTime() <= now.getTime()) {
    const winner = pickDeadlineWinner(options, counts)
    if (winner) {
      await sql()`
        update pulse.plans
        set state = 'struck', struck_option_id = ${winner.id}, struck_at = ${now}, version = version + 1
        where id = ${plan.id} and state = 'open'`
    } else {
      await sql()`
        update pulse.plans set state = 'expired', version = version + 1
        where id = ${plan.id} and state = 'open'`
    }
    plan = (await getPlanById(plan.id)) ?? plan
  }
  // The gathering has plausibly ended -> completed. Pre-struck_at rows fall back to created_at.
  if (plan.state === 'struck' && plan.struckOptionId) {
    const struckId = plan.struckOptionId
    const winner = options.find((o) => o.id === struckId)
    const startsAt = winner?.startsAt ?? null
    const dueAt = startsAt
      ? startsAt.getTime() + COMPLETE_BUFFER_MS
      : (plan.struckAt ?? plan.createdAt).getTime() + TIMELESS_COMPLETE_MS
    if (dueAt <= now.getTime()) {
      await sql()`
        update pulse.plans set state = 'completed', version = version + 1
        where id = ${plan.id} and state = 'struck'`
      plan = (await getPlanById(plan.id)) ?? plan
    }
  }
  return plan
}

/** The opener's plans for the dash, most recent first, each healed by resolvePlanState (a dash
 *  visit completes due plans without anyone opening the link). Completed plans stay visible, and
 *  each carries the VIEWER'S OWN ember standing only — getPublicEmber enforces the mutuality and
 *  silence-is-invisible rules, so nobody's non-response can reach the dash. */
export async function dashPlansForCreator(participantId: string, now: Date, limit = 10): Promise<PublicDashPlan[]> {
  const rows = await sql()`
    select * from pulse.plans where creator_participant_id = ${participantId}
    order by created_at desc limit ${limit}`
  if (rows.length === 0) return []
  const plans = rows.map(toPlan)
  const planIds = plans.map((p) => p.id)

  // Set-based reads: every plan's options (labels double as winner labels) and pick counts in one
  // query each, so the dash costs the same number of queries at 1 plan as at the cap. Sequential
  // on purpose: the local PGlite harness serializes one backend session (see resolvePlanState).
  const optionRows = await sql()`
    select * from pulse.plan_options where plan_id in ${sql()(planIds)}
    order by ai_rank, created_at`
  const countRows = await sql()`
    select plan_id, option_id, count(*)::int as n
    from pulse.plan_picks where plan_id in ${sql()(planIds)}
    group by plan_id, option_id`
  const optionsByPlan = new Map<string, PlanOption[]>()
  for (const r of optionRows as any[]) {
    const o = toOption(r)
    const list = optionsByPlan.get(o.planId) ?? []
    list.push(o)
    optionsByPlan.set(o.planId, list)
  }
  const countsByPlan = new Map<string, Map<string, number>>()
  for (const r of countRows as any[]) {
    const m = countsByPlan.get(r.planId) ?? new Map<string, number>()
    m.set(r.optionId as string, r.n as number)
    countsByPlan.set(r.planId, m)
  }

  // Healing stays sequential (writes fire only for plans actually due — typically none; the PGlite
  // harness serializes one backend session, see resolvePlanState).
  const healed: Plan[] = []
  for (const p of plans) {
    healed.push(await resolvePlanStateWith(
      p, now, optionsByPlan.get(p.id) ?? [], countsByPlan.get(p.id) ?? new Map(),
    ))
  }

  // Embers for completed plans in one read, shaped by the same visibility rules as the link view.
  const completedIds = healed.filter((p) => p.state === 'completed').map((p) => p.id)
  const tapsByPlan = await emberTapsForPlans(completedIds)

  return healed.map((plan) => {
    const winnerLabel = plan.struckOptionId
      ? (optionsByPlan.get(plan.id) ?? []).find((o) => o.id === plan.struckOptionId)?.label ?? null
      : null
    return {
      token: plan.token,
      intentText: plan.intentText,
      state: plan.state,
      winnerLabel,
      ember: plan.state === 'completed'
        ? publicEmberFromTaps(tapsByPlan.get(plan.id) ?? [], participantId)
        : null,
    }
  })
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
 *  own marks + the creator's name). The ONLY plan shape a route/page sends to the client.
 *  Every read heals state first (resolvePlanState) — deadline strikes and completion happen here. */
export async function getPublicPlanByToken(token: string, viewer: PublicViewer): Promise<PublicPlan | null> {
  let plan = await getPlanByToken(token)
  if (!plan) return null
  plan = await resolvePlanState(plan, new Date())
  const [options, counts] = await Promise.all([optionsForPlan(plan.id), pickCounts(plan.id)])
  const mine = viewer ? await myPicks(plan.id, viewer.participantId) : new Set<string>()
  const [creator] = await sql()`
    select display_name from pulse.participants where id = ${plan.creatorParticipantId}`
  return toPublicPlan(plan, (creator as any)?.displayName ?? null, options, counts, mine, viewer)
}

// Row type re-export so tests/routes can reference the pick row without a second import site.
export type { PlanPick }

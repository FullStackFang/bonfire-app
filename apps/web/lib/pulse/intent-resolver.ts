/* eslint-disable @typescript-eslint/no-explicit-any -- row mappers take dynamically-shaped
   postgres rows (camelCased); typing each as `any` is the established asker/repo boundary idiom. */
import { sql } from '../db'
import * as repo from './repo'
import { emberSeedIntent } from './ember-seed'
import { resolveAvailability, type AvailabilityWindow } from './availability'
import type { PublicIntentCandidate } from './types'

// The intent resolver (add-intent-layer): a PURE READ-TIME computation — the staleCrewMates /
// resolveAvailability precedent — that joins the viewer's mutual embers, mutual person intents, and
// availability into ranked draft-plan candidates. No materialized state, no cron, no timers, no
// writes of any kind: an unmatched intent costs nothing and triggers nothing. A plan row is created
// only when the viewer accepts a candidate (via the normal proposer), never here (design D5).
//
// Campfire doctrine (design D7): availability enters as an input and leaves as a DEFAULT — a
// suggested window — never as a stated fact about a person. Candidates surface only what the viewer
// co-owns (the mutual signal, the people, the shared activity) plus system-chosen timing.

const CANDIDATE_CAP = 6
const WINDOW_HOURS = 3
const WINDOW_DAYS = 6 // look this many days out for an availability overlap

type Person = { id: string; name: string }

type Candidate = {
  kind: 'compound' | 'ember' | 'person'
  people: Person[]
  activity: string | null
  seedIntent: string
}

const TIER: Record<Candidate['kind'], number> = { compound: 0, ember: 1, person: 2 }

/** Near-term evening windows anchored at ~19:00 UTC per day (baselines resolve in each person's OWN
 *  timezone within the window, so the anchor is only a coarse frame — the same coarseness the
 *  who's-around surface accepts). Skips a today-evening that has already passed. */
function nearTermWindows(now: Date): AvailabilityWindow[] {
  const windows: AvailabilityWindow[] = []
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(now.getTime())
    d.setUTCDate(d.getUTCDate() + i)
    d.setUTCHours(19, 0, 0, 0)
    if (d.getTime() < now.getTime()) continue
    windows.push({ startsAt: d, endsAt: new Date(d.getTime() + WINDOW_HOURS * 3600_000) })
  }
  return windows
}

/** The viewer's mutual embers: for every plan the viewer tapped "again", the full tap set — kept
 *  only when the ember is mutual (>= 2 taps, viewer included). Returns co-tappers (never the viewer). */
async function mutualEmbers(viewerId: string): Promise<{ activity: string; coTappers: Person[] }[]> {
  const rows = await sql()`
    select e.plan_id, e.intent_snapshot, t.participant_id, p.display_name
    from pulse.ember_taps t
    join pulse.embers e on e.id = t.ember_id
    join pulse.participants p on p.id = t.participant_id
    where e.plan_id in (
      select e2.plan_id from pulse.ember_taps t2
      join pulse.embers e2 on e2.id = t2.ember_id
      where t2.participant_id = ${viewerId}
    )
    order by t.tapped_at`
  const byPlan = new Map<string, { activity: string; taps: Person[] }>()
  for (const r of rows as any[]) {
    const g = byPlan.get(r.planId) ?? { activity: r.intentSnapshot as string, taps: [] }
    g.taps.push({ id: r.participantId, name: (r.displayName as string | null) ?? 'someone' })
    byPlan.set(r.planId, g)
  }
  const out: { activity: string; coTappers: Person[] }[] = []
  for (const g of byPlan.values()) {
    if (g.taps.length < 2) continue // not mutual — silence stays invisible
    const coTappers = g.taps.filter((t) => t.id !== viewerId)
    if (coTappers.length > 0) out.push({ activity: g.activity, coTappers })
  }
  return out
}

/** The viewer's mutual person-intent partners (both directed rows exist). */
async function mutualPartners(viewerId: string): Promise<Person[]> {
  const rows = await sql()`
    select a.to_participant_id as pid, p.display_name
    from pulse.person_intents a
    join pulse.person_intents b
      on b.from_participant_id = a.to_participant_id and b.to_participant_id = a.from_participant_id
    join pulse.participants p on p.id = a.to_participant_id
    where a.from_participant_id = ${viewerId}`
  return (rows as any[]).map((r) => ({ id: r.pid, name: (r.displayName as string | null) ?? 'someone' }))
}

/** Resolve availability for a set of people (plus the viewer) over near-term windows; return the
 *  soonest window with a POSITIVE overlap (nobody busy, at least one free/probably_free). `unknown`
 *  never blocks — it just isn't a positive signal, so an all-unknown group yields no window (and the
 *  candidate still appears, per spec). Never names or colors anyone's availability. */
async function suggestWindow(
  viewerId: string, peopleIds: string[], now: Date,
): Promise<AvailabilityWindow | null> {
  const ids = Array.from(new Set([viewerId, ...peopleIds]))
  const [baselines, exceptions] = await Promise.all([
    repo.baselinesForParticipants(ids),
    repo.exceptionsForParticipants(ids, now),
  ])
  for (const window of nearTermWindows(now)) {
    let anyPositive = false
    let anyBusy = false
    for (const id of ids) {
      const resolved = resolveAvailability({
        baselines: baselines.filter((b) => b.participantId === id).map((b) => ({
          daysOfWeek: b.daysOfWeek, startTime: b.startTime, endTime: b.endTime, timezone: b.timezone, label: b.label,
        })),
        exceptions: exceptions.filter((e) => e.participantId === id).map((e) => ({
          state: e.state, startsAt: e.startsAt, endsAt: e.endsAt, label: e.label, createdAt: e.createdAt,
        })),
        calendarBlocks: [],
        window,
      })
      if (resolved.availability === 'busy') { anyBusy = true; break }
      if (resolved.availability === 'free' || resolved.availability === 'probably_free') anyPositive = true
    }
    if (!anyBusy && anyPositive) return window
  }
  return null
}

/** Compute the viewer's ranked draft-plan candidates. Pure read — no writes anywhere. */
export async function resolveIntents(viewerId: string, now: Date = new Date()): Promise<PublicIntentCandidate[]> {
  const [embers, partners] = await Promise.all([mutualEmbers(viewerId), mutualPartners(viewerId)])
  const partnerIds = new Set(partners.map((p) => p.id))

  const candidates: Candidate[] = []
  const coveredPartners = new Set<string>()

  // Ember candidates. Compound when a co-tapper is also a mutual person-intent partner — the person
  // signal collapses INTO the ember candidate (one candidate, not two).
  for (const e of embers) {
    const isCompound = e.coTappers.some((c) => partnerIds.has(c.id))
    if (isCompound) e.coTappers.forEach((c) => { if (partnerIds.has(c.id)) coveredPartners.add(c.id) })
    candidates.push({
      kind: isCompound ? 'compound' : 'ember',
      people: e.coTappers,
      activity: e.activity,
      seedIntent: emberSeedIntent(e.activity, e.coTappers.map((c) => c.name)),
    })
  }

  // Person-only candidates: a mutual partner with no shared mutual ember. Seeds the pair alone (no
  // activity), exactly like a reconnect suggestion — the proposer fills in the activity.
  for (const p of partners) {
    if (coveredPartners.has(p.id)) continue
    candidates.push({ kind: 'person', people: [p], activity: null, seedIntent: `catch up with ${p.name}` })
  }

  // Rank by tier, cap. Availability is resolved ONLY for the best tier present (design/spec: cap the
  // fan-out — a window overlap re-sorts within that tier; lower tiers show without a window).
  candidates.sort((a, b) => TIER[a.kind] - TIER[b.kind])
  const capped = candidates.slice(0, CANDIDATE_CAP)
  const topTier = capped.length > 0 ? TIER[capped[0]!.kind] : Infinity

  const withWindows = await Promise.all(
    capped.map(async (c) => {
      const suggestedWindow = TIER[c.kind] === topTier
        ? await suggestWindow(viewerId, c.people.map((p) => p.id), now)
        : null
      return {
        key: `${c.kind}:${c.people.map((p) => p.id).sort().join(',')}`,
        kind: c.kind,
        people: c.people.map((p) => p.name),
        activity: c.activity,
        seedIntent: c.seedIntent,
        suggestedWindow: suggestedWindow
          ? { startsAt: suggestedWindow.startsAt.toISOString(), endsAt: suggestedWindow.endsAt.toISOString() }
          : null,
      }
    }),
  )

  // Within the top tier, a resolved availability overlap ranks above none (stable otherwise).
  return withWindows.sort((a, b) => {
    if (TIER[a.kind] !== TIER[b.kind]) return TIER[a.kind] - TIER[b.kind]
    return (a.suggestedWindow ? 0 : 1) - (b.suggestedWindow ? 0 : 1)
  })
}

/* eslint-disable @typescript-eslint/no-explicit-any -- row mappers take dynamically-shaped
   postgres rows (camelCased); typing each as `any` is the established asker/repo boundary idiom. */
import { sql } from '../db'
import type { ReconnectPrefs, PublicReconnect, PublicReconnectSuggestion, PublicViewer } from './types'

// Relationship intelligence (growth-story Phase 3). Recency is DERIVED from real in-app co-presence
// (struck plans you both attended) over the crew graph — never a scraped address book. The proactive
// card is opt-in (off by default), frequency-capped, per-person mutable, and scoped to crew-mates.
// Nothing is ever sent on the viewer's behalf; "Plan it" just seeds the normal Phase 1 plan flow.

const DAY_MS = 24 * 3600_000
const MIN_STALE_DAYS = 14 // don't nudge about someone you saw recently
const CAP_HOURS = 20 // show a suggestion at most ~once per this window

const toPrefs = (r: any): ReconnectPrefs => ({
  participantId: r.participantId, enabled: r.enabled,
  lastShownAt: r.lastShownAt ?? null, muted: (r.muted ?? []) as string[], updatedAt: r.updatedAt,
})

const DEFAULT_PREFS = (participantId: string): ReconnectPrefs => ({
  participantId, enabled: false, lastShownAt: null, muted: [], updatedAt: new Date(0),
})

// ---- prefs ----

export async function getPrefs(participantId: string): Promise<ReconnectPrefs> {
  const [row] = await sql()`select * from pulse.reconnect_prefs where participant_id = ${participantId}`
  return row ? toPrefs(row) : DEFAULT_PREFS(participantId)
}

export async function setEnabled(participantId: string, enabled: boolean): Promise<ReconnectPrefs> {
  const [row] = await sql()`
    insert into pulse.reconnect_prefs (participant_id, enabled, updated_at)
    values (${participantId}, ${enabled}, now())
    on conflict (participant_id) do update set enabled = ${enabled}, updated_at = now()
    returning *`
  return toPrefs(row)
}

export async function mute(participantId: string, personId: string): Promise<void> {
  await sql()`
    insert into pulse.reconnect_prefs (participant_id, muted, updated_at)
    values (${participantId}, array[${personId}]::uuid[], now())
    on conflict (participant_id) do update
      set muted = (select array(select distinct unnest(pulse.reconnect_prefs.muted || array[${personId}]::uuid[]))),
          updated_at = now()`
}

export async function markShown(participantId: string, now: Date = new Date()): Promise<void> {
  await sql()`
    insert into pulse.reconnect_prefs (participant_id, last_shown_at, updated_at)
    values (${participantId}, ${now}, now())
    on conflict (participant_id) do update set last_shown_at = ${now}, updated_at = now()`
}

// ---- the recency engine (derived) ----

export type StaleMate = { participantId: string; displayName: string; lastTogetherAt: Date | null }

/** Crew-mates of the viewer, each with their most recent co-attendance (a struck plan where BOTH
 *  marked the winning option). Ordered stalest-first (never-together at the top). Derived — never
 *  reads contacts. */
export async function staleCrewMates(viewerId: string): Promise<StaleMate[]> {
  const rows = await sql()`
    with mates as (
      select distinct cm2.participant_id as pid
      from pulse.crew_members cm1
      join pulse.crew_members cm2 on cm1.crew_id = cm2.crew_id
      where cm1.participant_id = ${viewerId} and cm2.participant_id <> ${viewerId}
    ),
    together as (
      select pk2.participant_id as pid, max(pl.created_at) as last_at
      from pulse.plans pl
      join pulse.plan_picks pk1 on pk1.plan_id = pl.id and pk1.option_id = pl.struck_option_id and pk1.participant_id = ${viewerId}
      join pulse.plan_picks pk2 on pk2.plan_id = pl.id and pk2.option_id = pl.struck_option_id and pk2.participant_id <> ${viewerId}
      where pl.state = 'struck'
      group by pk2.participant_id
    )
    select m.pid as participant_id, p.display_name, t.last_at as last_together_at
    from mates m
    join pulse.participants p on p.id = m.pid
    left join together t on t.pid = m.pid
    order by t.last_at asc nulls first`
  return rows.map((r: any): StaleMate => ({
    participantId: r.participantId, displayName: r.displayName ?? 'Someone',
    lastTogetherAt: r.lastTogetherAt ?? null,
  }))
}

/** The one proactive suggestion for the viewer, or null. Respects opt-in, the cadence cap, mutes,
 *  and the staleness floor. The stalest non-muted crew-mate who is actually stale enough. */
export async function getSuggestion(
  viewerId: string, now: Date = new Date(),
): Promise<PublicReconnectSuggestion | null> {
  const prefs = await getPrefs(viewerId)
  if (!prefs.enabled) return null
  if (prefs.lastShownAt && now.getTime() - new Date(prefs.lastShownAt).getTime() < CAP_HOURS * 3600_000) return null

  const mates = await staleCrewMates(viewerId)
  const candidate = mates.find((m) => !prefs.muted.includes(m.participantId))
  if (!candidate) return null

  const daysSince = candidate.lastTogetherAt
    ? Math.floor((now.getTime() - new Date(candidate.lastTogetherAt).getTime()) / DAY_MS)
    : null
  // Not stale enough (and since it's the stalest non-muted, nobody is) → no nudge.
  if (daysSince !== null && daysSince < MIN_STALE_DAYS) return null

  return { participantId: candidate.participantId, displayName: candidate.displayName, daysSince }
}

export async function getPublicReconnect(viewer: PublicViewer, now: Date = new Date()): Promise<PublicReconnect> {
  if (!viewer) return { enabled: false, suggestion: null }
  const prefs = await getPrefs(viewer.participantId)
  return { enabled: prefs.enabled, suggestion: await getSuggestion(viewer.participantId, now) }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- row mappers take dynamically-shaped
   postgres rows (camelCased); typing each as `any` is the established asker/repo boundary idiom. */
import { sql } from '../db'
import type { Plan, PublicFace, PublicPersonIntent } from './types'

// The person half of recurrence (add-intent-layer): a directed "I want to see them again" tap toward
// a co-attendee, captured on the afterglow screen. Transposes the ember's proven privacy model onto a
// DIRECTED PAIR — one standing row per (from, to), mutual-only symmetric reveal, one-sided interest
// revealed to no one, withdrawable. Silence is structurally invisible: nothing here can name, count,
// or imply a one-sided-toward-you intent, and the recipient of an unreciprocated tap sees exactly
// what they'd see if it had never happened (person-intent spec).

/** May `fromId` tap `toId`? The same attendance proxy as the ember, checked for BOTH endpoints: the
 *  plan is completed and each marked the winning option ("they were both in"). Tier-0 ghosts qualify
 *  like anyone. There is no browse-a-directory path — you can only tap someone you were just with. */
export async function canTapPerson(plan: Plan, fromId: string, toId: string): Promise<boolean> {
  if (fromId === toId) return false
  if (plan.state !== 'completed' || !plan.struckOptionId) return false
  const [row] = await sql()`
    select count(*)::int as n from pulse.plan_picks
    where option_id = ${plan.struckOptionId} and participant_id in (${fromId}, ${toId})`
  return Number((row as any)?.n) === 2
}

/** Record a person intent from → to. Idempotent on the pair PK: re-tapping (from this or any later
 *  gathering) records nothing new and the original timestamp stands. Eligibility is the caller's job
 *  (canTapPerson). `source_plan_id` captures where it happened, for the resolver's seed context. */
export async function tapPerson(plan: Plan, fromId: string, toId: string): Promise<void> {
  await sql()`
    insert into pulse.person_intents (from_participant_id, to_participant_id, source_plan_id)
    values (${fromId}, ${toId}, ${plan.id})
    on conflict (from_participant_id, to_participant_id) do nothing`
}

/** Withdraw the author's intent toward `toId`. Deleting the row reverts any mutual reveal on BOTH
 *  sides — the recipient's mutual badge disappears too, and their own standing tap (if any) reverts
 *  to one-sided-invisible. Never mints anything; a no-op when no row exists. */
export async function untapPerson(fromId: string, toId: string): Promise<void> {
  await sql()`
    delete from pulse.person_intents
    where from_participant_id = ${fromId} and to_participant_id = ${toId}`
}

/** Pure visibility rule for one directed pair from the viewer's vantage — the single implementation
 *  behind every read path so per-face and batched reads cannot diverge:
 *   - `mine` = the viewer tapped this person; `theirs` = this person tapped the viewer.
 *   - The viewer sees only their OWN standing (`tapped: mine`); a one-sided tap toward the viewer
 *     (theirs && !mine) is invisible — the empty shape, indistinguishable from silence.
 *   - `mutual` is true only when both rows exist, revealed symmetrically to both, with no tap order. */
export function publicPersonIntent(mine: boolean, theirs: boolean): PublicPersonIntent {
  return { tapped: mine, mutual: mine && theirs }
}

/** The afterglow's tappable faces (zone two): the plan's OTHER winning-option markers, each carrying
 *  the viewer's own tap state and any mutual reveal. Returns [] unless the plan is completed and the
 *  viewer is themselves a winning-option marker (non-attendees get no faces — again-engine spec).
 *  One-sided-toward-the-viewer rows never leave here: publicPersonIntent collapses them to empty. */
export async function personFacesForPlan(plan: Plan, viewerId: string | null): Promise<PublicFace[]> {
  if (!viewerId || plan.state !== 'completed' || !plan.struckOptionId) return []

  // The viewer must be a winning-option marker to see faces at all.
  const markers = await sql()`
    select p.id, p.display_name
    from pulse.plan_picks pk
    join pulse.participants p on p.id = pk.participant_id
    where pk.option_id = ${plan.struckOptionId}
    order by p.display_name`
  const rows = markers as any[]
  if (!rows.some((r) => r.id === viewerId)) return []

  const faceIds = rows.filter((r) => r.id !== viewerId).map((r) => r.id as string)
  if (faceIds.length === 0) return []

  // The viewer's own directed edges to/from these faces — the ONLY intent data read.
  const edges = await sql()`
    select from_participant_id, to_participant_id from pulse.person_intents
    where (from_participant_id = ${viewerId} and to_participant_id = any(${faceIds}))
       or (to_participant_id = ${viewerId} and from_participant_id = any(${faceIds}))`
  const mine = new Set<string>() // viewer -> face
  const theirs = new Set<string>() // face -> viewer
  for (const e of edges as any[]) {
    if (e.fromParticipantId === viewerId) mine.add(e.toParticipantId)
    else theirs.add(e.fromParticipantId)
  }

  return rows
    .filter((r) => r.id !== viewerId)
    .map((r): PublicFace => {
      const { tapped, mutual } = publicPersonIntent(mine.has(r.id), theirs.has(r.id))
      return { participantId: r.id, displayName: (r.displayName as string | null) ?? 'someone', tapped, mutual }
    })
}

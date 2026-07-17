/* eslint-disable @typescript-eslint/no-explicit-any -- row mappers take dynamically-shaped
   postgres rows (camelCased); typing each as `any` is the established asker/repo boundary idiom. */
import { sql } from '../db'
import type { Plan, PublicEmber } from './types'

// The again engine (close-plan-loop): capture recurrence intent at the moment courage is free —
// right after the gathering happened. One ember per completed plan, created lazily on the FIRST
// "again" tap; taps are membership. Silence is structurally invisible: nothing in this module can
// name, count, or imply an eligible-but-untapped participant, and one-sided interest is revealed
// to no one in either direction (SYSTEM-THESIS §iv, again-engine spec).

/** May this participant tap? The plan is completed and they marked the winning option — "they
 *  were in", the same attendance proxy relationship-intelligence uses. Tier-0 ghosts qualify
 *  like anyone (their identity is the existing per-link participant row). */
export async function canTapEmber(plan: Plan, participantId: string): Promise<boolean> {
  if (plan.state !== 'completed' || !plan.struckOptionId) return false
  const [row] = await sql()`
    select 1 as ok from pulse.plan_picks
    where option_id = ${plan.struckOptionId} and participant_id = ${participantId}`
  return !!row
}

/** Record an "again" tap: create the plan's ember if none exists (snapshotting the plan's intent
 *  so the ember survives independently) and add the tap. Both statements are conflict-tolerant —
 *  a double tap records exactly once. Eligibility is the caller's job (canTapEmber). */
export async function tapEmber(plan: Plan, participantId: string): Promise<void> {
  await sql().begin(async (tx) => {
    await tx`
      insert into pulse.embers (plan_id, intent_snapshot)
      values (${plan.id}, ${plan.intentText})
      on conflict (plan_id) do nothing`
    const [ember] = await tx`select id from pulse.embers where plan_id = ${plan.id}`
    await tx`
      insert into pulse.ember_taps (ember_id, participant_id)
      values (${(ember as any).id}, ${participantId})
      on conflict (ember_id, participant_id) do nothing`
  })
}

/** Withdraw a tap (changed your mind). If the ember drops below two taps it reverts to
 *  non-mutual visibility — co-tapper names hide again. The ember row itself stays. */
export async function untapEmber(plan: Plan, participantId: string): Promise<void> {
  await sql()`
    delete from pulse.ember_taps t
    using pulse.embers e
    where e.id = t.ember_id and e.plan_id = ${plan.id} and t.participant_id = ${participantId}`
}

const NO_EMBER: PublicEmber = { tapped: false, mutual: false, coTappers: [] }

/** The ONLY ember shape sent to a client — visibility is enforced here, structurally:
 *  - a viewer who hasn't tapped (or has no identity) gets the empty shape: no count, no names,
 *    not even whether the ember exists;
 *  - a solo tapper sees only their own standing tap;
 *  - co-tapper names appear only once the ember is mutual (>= 2 taps), tappers only.
 *  Eligible-but-untapped participants can never appear in any payload — the query starts from
 *  tap rows, so there is no data path to the untapped. */
export async function getPublicEmber(planId: string, participantId: string | null): Promise<PublicEmber> {
  if (!participantId) return NO_EMBER
  const taps = await sql()`
    select t.participant_id, p.display_name
    from pulse.ember_taps t
    join pulse.embers e on e.id = t.ember_id
    join pulse.participants p on p.id = t.participant_id
    where e.plan_id = ${planId}
    order by t.tapped_at`
  if (!taps.some((t: any) => t.participantId === participantId)) return NO_EMBER
  const mutual = taps.length >= 2
  return {
    tapped: true,
    mutual,
    coTappers: mutual
      ? taps.filter((t: any) => t.participantId !== participantId)
          .map((t: any) => (t.displayName as string | null) ?? 'someone')
      : [],
  }
}

// The seed-intent composer lives in ./ember-seed (pure, client-safe); re-exported here so
// server code and tests can import the whole engine from one place.
export { emberSeedIntent } from './ember-seed'

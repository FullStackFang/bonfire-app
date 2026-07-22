/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic-import test helpers over the loosely-
   typed pulse modules; same boundary idiom the lib files use. */
import { describe, it, expect, beforeAll } from 'vitest'
import { publicPersonIntent } from './person-intent'

// DB-gated, mirroring ember.test.ts: runs only when TEST_DATABASE_URL is set (apply migrations
// first). Covers the person-intent engine: eligibility, idempotent taps, withdrawal reverting the
// mutual reveal on both sides, and — most importantly — the one-sided-is-invisible rules.
const url = process.env.TEST_DATABASE_URL

// Pure — no DB needed. The visibility rule is the heart of the privacy contract.
describe('publicPersonIntent', () => {
  it('shows the viewer only their own standing; a one-sided tap toward them is invisible', () => {
    expect(publicPersonIntent(false, false)).toEqual({ tapped: false, mutual: false }) // silence
    expect(publicPersonIntent(true, false)).toEqual({ tapped: true, mutual: false }) // author only
    expect(publicPersonIntent(false, true)).toEqual({ tapped: false, mutual: false }) // recipient sees nothing
    expect(publicPersonIntent(true, true)).toEqual({ tapped: true, mutual: true }) // mutual, symmetric
  })
  it('carries no timestamp or tap-order field in the public shape', () => {
    expect(Object.keys(publicPersonIntent(true, true)).sort()).toEqual(['mutual', 'tapped'])
  })
})

describe.skipIf(!url)('person-intent engine (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
  })

  const HOUR = 3600_000

  // A completed plan with three winning-option markers (dana, priya, sam) and one outsider who marked
  // the losing option (not eligible). Mirrors ember.test.ts's fixture.
  async function completedPlan() {
    const repo = await import('./repo')
    const plan = await import('./plan')
    const { newToken } = await import('../ids')
    const now = new Date()

    const creator = await repo.createParticipant(newToken())
    const dana = await repo.setDisplayName((await repo.createParticipant(newToken())).id, 'Dana')
    const priya = await repo.setDisplayName((await repo.createParticipant(newToken())).id, 'Priya')
    const sam = await repo.setDisplayName((await repo.createParticipant(newToken())).id, 'Sam')
    const outsider = await repo.createParticipant(newToken())

    const p = await plan.createPlan({
      token: newToken(), creatorParticipantId: creator.id,
      intentText: 'tennis saturday', confirmThreshold: 3,
    })
    const [win, lose] = await plan.setOptions(p.id, [
      { kind: 'time', label: 'Sat 10:00 AM', startsAt: new Date(now.getTime() - 6 * HOUR), aiRank: 0 },
      { kind: 'time', label: 'Sun 4:00 PM', startsAt: new Date(now.getTime() + 50 * HOUR), aiRank: 1 },
    ])
    await plan.publishPlan(p.id, creator.id)
    await plan.recordAvailabilityAndMaybeStrike(p.id, lose!.id, outsider.id, now)
    await plan.recordAvailabilityAndMaybeStrike(p.id, win!.id, dana.id, now)
    await plan.recordAvailabilityAndMaybeStrike(p.id, win!.id, priya.id, now)
    await plan.recordAvailabilityAndMaybeStrike(p.id, win!.id, sam.id, now)
    const completed = await plan.resolvePlanState((await plan.getPlanById(p.id))!, now)
    expect(completed.state).toBe('completed')
    return { plan: completed, dana, priya, sam, outsider }
  }

  it('eligibility: both endpoints must be winning-option markers of a completed plan', async () => {
    const pi = await import('./person-intent')
    const { plan, dana, priya, outsider } = await completedPlan()
    expect(await pi.canTapPerson(plan, dana.id, priya.id)).toBe(true)
    expect(await pi.canTapPerson(plan, dana.id, outsider.id)).toBe(false) // target marked the loser
    expect(await pi.canTapPerson(plan, outsider.id, dana.id)).toBe(false) // author marked the loser
    expect(await pi.canTapPerson(plan, dana.id, dana.id)).toBe(false) // no self-tap
    expect(await pi.canTapPerson({ ...plan, state: 'struck' }, dana.id, priya.id)).toBe(false)
  })

  it('a re-tap from a later gathering records once and preserves the original timestamp', async () => {
    const pi = await import('./person-intent')
    const { sql } = await import('../db')
    const { plan, dana, priya } = await completedPlan()

    await pi.tapPerson(plan, dana.id, priya.id)
    const [first] = await sql()`
      select created_at from pulse.person_intents
      where from_participant_id = ${dana.id} and to_participant_id = ${priya.id}`
    // Nudge the stored timestamp into the past, then re-tap — the original must stand.
    await sql()`
      update pulse.person_intents set created_at = created_at - interval '10 days'
      where from_participant_id = ${dana.id} and to_participant_id = ${priya.id}`
    await pi.tapPerson(plan, dana.id, priya.id)
    const rows = await sql()`
      select created_at from pulse.person_intents
      where from_participant_id = ${dana.id} and to_participant_id = ${priya.id}`
    expect(rows).toHaveLength(1)
    expect(new Date((rows[0] as any).createdAt).getTime())
      .toBeLessThan(new Date((first as any).createdAt).getTime())
  })

  it('a one-sided intent is invisible to its recipient; the author sees only their own standing', async () => {
    const pi = await import('./person-intent')
    const { plan, dana, priya } = await completedPlan()
    await pi.tapPerson(plan, dana.id, priya.id) // Dana -> Priya only

    const danaSees = await pi.personFacesForPlan(plan, dana.id)
    const danaToPriya = danaSees.find((f) => f.participantId === priya.id)!
    expect(danaToPriya).toMatchObject({ tapped: true, mutual: false })

    // Priya (the recipient) sees NO trace — her face-for-Dana is the empty shape.
    const priyaSees = await pi.personFacesForPlan(plan, priya.id)
    const priyaToDana = priyaSees.find((f) => f.participantId === dana.id)!
    expect(priyaToDana).toMatchObject({ tapped: false, mutual: false })
  })

  it('mutuality reveals symmetrically; withdrawal reverts it on both sides', async () => {
    const pi = await import('./person-intent')
    const { plan, dana, priya } = await completedPlan()
    await pi.tapPerson(plan, dana.id, priya.id)
    await pi.tapPerson(plan, priya.id, dana.id) // completes the pair

    const danaFace = (await pi.personFacesForPlan(plan, dana.id)).find((f) => f.participantId === priya.id)!
    const priyaFace = (await pi.personFacesForPlan(plan, priya.id)).find((f) => f.participantId === dana.id)!
    expect(danaFace).toMatchObject({ tapped: true, mutual: true })
    expect(priyaFace).toMatchObject({ tapped: true, mutual: true })

    // Priya withdraws — the mutual reveal disappears for BOTH.
    await pi.untapPerson(priya.id, dana.id)
    const danaAfter = (await pi.personFacesForPlan(plan, dana.id)).find((f) => f.participantId === priya.id)!
    const priyaAfter = (await pi.personFacesForPlan(plan, priya.id)).find((f) => f.participantId === dana.id)!
    expect(danaAfter).toMatchObject({ tapped: true, mutual: false }) // Dana's own tap stands, no longer mutual
    expect(priyaAfter).toMatchObject({ tapped: false, mutual: false }) // Priya withdrew — nothing
  })

  it('faces render only to winning-option markers; a non-attendee gets none', async () => {
    const pi = await import('./person-intent')
    const { plan, dana, outsider } = await completedPlan()
    const danaFaces = await pi.personFacesForPlan(plan, dana.id)
    expect(danaFaces.map((f) => f.displayName).sort()).toEqual(['Priya', 'Sam'])
    expect(danaFaces.some((f) => f.participantId === dana.id)).toBe(false) // never the viewer themself
    expect(await pi.personFacesForPlan(plan, outsider.id)).toEqual([]) // marked the loser -> no faces
    expect(await pi.personFacesForPlan(plan, null)).toEqual([]) // signed-out -> nothing
  })
})

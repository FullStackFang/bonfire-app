import { describe, it, expect, beforeAll } from 'vitest'
import { emberSeedIntent } from './ember-seed'

// DB-gated, mirroring plan.test.ts: runs only when TEST_DATABASE_URL is set (apply
// supabase/migrations first). Covers the again engine: create-on-first-tap, idempotent taps,
// un-tap, eligibility, and — most importantly — the silence-is-invisible serializer rules
// (solo tapper sees only self, non-tapper gets nothing, untapped participants never appear).
const url = process.env.TEST_DATABASE_URL

// Pure — no DB needed.
describe('emberSeedIntent', () => {
  it('credits co-tappers by name', () => {
    expect(emberSeedIntent('tennis saturday', ['Dana'])).toBe('again: tennis saturday with Dana')
    expect(emberSeedIntent('tennis saturday', ['Dana', 'Priya'])).toBe('again: tennis saturday with Dana and Priya')
    expect(emberSeedIntent('tennis', ['A', 'B', 'C'])).toBe('again: tennis with A, B and C')
  })
  it('stands alone without names', () => {
    expect(emberSeedIntent('tennis saturday', [])).toBe('again: tennis saturday')
  })
})

describe.skipIf(!url)('ember engine (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
  })

  const HOUR = 3600_000

  // A completed plan with three participants who marked the winning option ("were in") and one
  // who marked the losing option (not eligible). Returns everyone + the completed plan row.
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
    const r = await plan.recordAvailabilityAndMaybeStrike(p.id, win!.id, sam.id, now)
    expect(r.kind).toBe('struck')
    // The winning start was 6h ago -> past the 4h buffer -> completes on read.
    const completed = await plan.resolvePlanState((await plan.getPlanById(p.id))!, now)
    expect(completed.state).toBe('completed')
    return { plan: completed, dana, priya, sam, outsider, creator }
  }

  it('the first tap creates the ember with the intent snapshot; a double tap records once', async () => {
    const ember = await import('./ember')
    const { sql } = await import('../db')
    const { plan, dana } = await completedPlan()

    await ember.tapEmber(plan, dana.id)
    const [row] = await sql()`select * from pulse.embers where plan_id = ${plan.id}`
    expect(row).toBeTruthy()
    expect((row as { intentSnapshot: string }).intentSnapshot).toBe('tennis saturday')

    await ember.tapEmber(plan, dana.id) // again — same participant
    const taps = await sql()`
      select * from pulse.ember_taps t join pulse.embers e on e.id = t.ember_id
      where e.plan_id = ${plan.id}`
    expect(taps).toHaveLength(1)
  })

  it('eligibility: winning-option markers only, completed plans only', async () => {
    const ember = await import('./ember')
    const { plan, dana, outsider, creator } = await completedPlan()
    expect(await ember.canTapEmber(plan, dana.id)).toBe(true)
    expect(await ember.canTapEmber(plan, outsider.id)).toBe(false) // marked the losing option
    expect(await ember.canTapEmber(plan, creator.id)).toBe(false) // never marked the winner
    expect(await ember.canTapEmber({ ...plan, state: 'struck' }, dana.id)).toBe(false)
  })

  it('a solo tapper sees only their own standing — no names, no counts', async () => {
    const ember = await import('./ember')
    const { plan, dana } = await completedPlan()
    await ember.tapEmber(plan, dana.id)
    expect(await ember.getPublicEmber(plan.id, dana.id)).toEqual({
      tapped: true, mutual: false, coTappers: [],
    })
  })

  it('a non-tapper (and a signed-out viewer) gets nothing, even when others tapped', async () => {
    const ember = await import('./ember')
    const { plan, dana, priya, sam } = await completedPlan()
    await ember.tapEmber(plan, dana.id)
    await ember.tapEmber(plan, priya.id)
    const empty = { tapped: false, mutual: false, coTappers: [] }
    expect(await ember.getPublicEmber(plan.id, sam.id)).toEqual(empty) // eligible but untapped
    expect(await ember.getPublicEmber(plan.id, null)).toEqual(empty)
  })

  it('mutuality reveals co-tappers to tappers only, and never the untapped', async () => {
    const ember = await import('./ember')
    const { plan, dana, priya } = await completedPlan()
    await ember.tapEmber(plan, dana.id)
    await ember.tapEmber(plan, priya.id)
    const mine = await ember.getPublicEmber(plan.id, dana.id)
    expect(mine).toEqual({ tapped: true, mutual: true, coTappers: ['Priya'] })
    // Sam marked the winner but never tapped — Sam's name must appear in NO payload.
    expect(mine.coTappers).not.toContain('Sam')
    const theirs = await ember.getPublicEmber(plan.id, priya.id)
    expect(theirs.coTappers).toEqual(['Dana'])
  })

  it('an un-tap reverts mutuality — co-tapper names hide again', async () => {
    const ember = await import('./ember')
    const { plan, dana, priya } = await completedPlan()
    await ember.tapEmber(plan, dana.id)
    await ember.tapEmber(plan, priya.id)
    await ember.untapEmber(plan, priya.id)
    expect(await ember.getPublicEmber(plan.id, dana.id)).toEqual({
      tapped: true, mutual: false, coTappers: [],
    })
    expect(await ember.getPublicEmber(plan.id, priya.id)).toEqual({
      tapped: false, mutual: false, coTappers: [],
    })
  })

  // Seeding the next plan (design D6): a normal `proposing` plan with the pre-seeded intent,
  // owned by the initiator. Nothing is dispatched — the pulse rail has no messaging path, and
  // creation writes only the plan row (the initiator shares the link themselves).
  it('a seeded plan is a normal proposing plan; nothing is sent to anyone', async () => {
    const plan = await import('./plan')
    const { newToken } = await import('../ids')
    const { plan: done, dana, priya } = await completedPlan()
    const ember = await import('./ember')
    await ember.tapEmber(done, dana.id)
    await ember.tapEmber(done, priya.id)
    const standing = await ember.getPublicEmber(done.id, dana.id)

    const seeded = await plan.createPlan({
      token: newToken(), creatorParticipantId: dana.id,
      intentText: emberSeedIntent(done.intentText, standing.coTappers),
    })
    expect(seeded.state).toBe('proposing')
    expect(seeded.intentText).toBe('again: tennis saturday with Priya')
    expect(seeded.creatorParticipantId).toBe(dana.id)
  })
})

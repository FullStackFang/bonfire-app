import { describe, it, expect, beforeAll } from 'vitest'

// DB-gated, mirroring lib/pulse/repo.test.ts: runs only when TEST_DATABASE_URL is set
// (apply supabase/migrations first). Covers the strike transaction (threshold, exactly-once under
// concurrency, closed/invalid guards) — the ported asker.replyAndMaybeStrike logic on pulse.*.
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('plan strike (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4' // real concurrency for the exactly-once test
  })

  async function fixtures(n: number) {
    const repo = await import('./repo')
    const plan = await import('./plan')
    const { newToken } = await import('../ids')
    const creator = await repo.createParticipant(newToken())
    const invitees = []
    for (let i = 0; i < n; i++) invitees.push(await repo.createParticipant(newToken()))
    return { repo, plan, newToken, creator, invitees }
  }

  // An open plan with two options and a given confirm threshold.
  async function openPlan(threshold: number) {
    const { plan, newToken, creator, invitees } = await fixtures(4)
    const p = await plan.createPlan({
      token: newToken(), creatorParticipantId: creator.id,
      intentText: 'Dinner next week', confirmThreshold: threshold,
    })
    const [optA, optB] = await plan.setOptions(p.id, [
      { kind: 'time_place', label: 'Thu 7:00 PM · Loring Place', startsAt: new Date(Date.now() + 3 * 864e5) },
      { kind: 'time_place', label: 'Fri 7:30 PM · Via Carota', startsAt: new Date(Date.now() + 4 * 864e5) },
    ])
    const published = await plan.publishPlan(p.id, creator.id)
    expect(published?.state).toBe('open')
    return { plan, p, optA: optA!, optB: optB!, invitees, creator }
  }

  it('below threshold records but does not strike', async () => {
    const { plan, p, optA, invitees } = await openPlan(3)
    const r = await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, new Date())
    expect(r.kind).toBe('recorded')
    const after = await plan.getPlanById(p.id)
    expect(after?.state).toBe('open')
    expect(after?.struckOptionId).toBeNull()
  })

  it('reaching the threshold strikes on that option', async () => {
    const { plan, p, optA, invitees } = await openPlan(2)
    await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, new Date())
    const second = await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[1]!.id, new Date())
    expect(second.kind).toBe('struck')
    expect(second).toMatchObject({ winnerOptionId: optA.id })
    const after = await plan.getPlanById(p.id)
    expect(after?.state).toBe('struck')
    expect(after?.struckOptionId).toBe(optA.id)
  })

  it('re-tapping the same option is idempotent (no double count, no strike)', async () => {
    const { plan, p, optA, invitees } = await openPlan(2)
    await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, new Date())
    const again = await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, new Date())
    expect(again.kind).toBe('recorded') // same invitee — count stays at 1
    const counts = await plan.pickCounts(p.id)
    expect(counts.get(optA.id)).toBe(1)
  })

  // True-parallel exactly-once: requires a backend that supports concurrent connections. The local
  // PGlite harness (single serial wasm backend behind pg-gateway) corrupts the extended-query
  // protocol when two connections interleave, so gate this behind TEST_PG_CONCURRENCY (set it when
  // TEST_DATABASE_URL points at real Postgres — Supabase/CI). The FOR UPDATE serialization it checks
  // is the same mechanism asker.replyAndMaybeStrike relies on; the sequential tests above prove the
  // threshold/idempotency logic on any backend.
  it.skipIf(!process.env.TEST_PG_CONCURRENCY)('concurrent threshold-crossing picks strike exactly once', async () => {
    const { plan, p, optA, invitees } = await openPlan(2)
    const [r1, r2] = await Promise.all([
      plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, new Date()),
      plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[1]!.id, new Date()),
    ])
    const strikes = [r1, r2].filter((r) => r.kind === 'struck')
    expect(strikes).toHaveLength(1)
    const after = await plan.getPlanById(p.id)
    expect(after?.state).toBe('struck')
    expect(after?.struckOptionId).toBe(optA.id)
  })

  it('a pick on a struck plan is closed', async () => {
    const { plan, p, optA, optB, invitees } = await openPlan(2)
    await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, new Date())
    await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[1]!.id, new Date()) // strikes
    const late = await plan.recordAvailabilityAndMaybeStrike(p.id, optB.id, invitees[2]!.id, new Date())
    expect(late.kind).toBe('closed')
  })

  it('a foreign option id is rejected as invalid', async () => {
    const { plan, p, invitees } = await openPlan(2)
    const bogus = '00000000-0000-0000-0000-000000000000'
    const r = await plan.recordAvailabilityAndMaybeStrike(p.id, bogus, invitees[0]!.id, new Date())
    expect(r.kind).toBe('invalid')
  })
})

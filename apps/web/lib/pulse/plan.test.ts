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

// pickDeadlineWinner is pure — no DB needed. Most availability, tie -> earliest start
// (timeless last), still tied -> lowest rank.
describe('pickDeadlineWinner', () => {
  const opt = (id: string, aiRank: number, startsAt: Date | null) => ({
    id, planId: 'p', kind: 'time' as const, startsAt, venue: null, label: id,
    aiRank, aiRationale: null, source: 'ai' as const, createdAt: new Date(),
  })
  const at = (h: number) => new Date(Date.UTC(2026, 6, 20, h))

  it('is null when nothing was marked anywhere', async () => {
    const { pickDeadlineWinner } = await import('./plan')
    expect(pickDeadlineWinner([opt('a', 0, at(18))], new Map())).toBeNull()
  })

  it('picks the option with the most availability', async () => {
    const { pickDeadlineWinner } = await import('./plan')
    const w = pickDeadlineWinner(
      [opt('a', 0, at(18)), opt('b', 1, at(20))],
      new Map([['a', 1], ['b', 2]]),
    )
    expect(w?.id).toBe('b')
  })

  it('breaks a tie by earliest start time, with timeless options last', async () => {
    const { pickDeadlineWinner } = await import('./plan')
    const w = pickDeadlineWinner(
      [opt('late', 0, at(20)), opt('early', 1, at(18)), opt('timeless', 2, null)],
      new Map([['late', 2], ['early', 2], ['timeless', 2]]),
    )
    expect(w?.id).toBe('early')
  })

  it('breaks a remaining tie by option rank', async () => {
    const { pickDeadlineWinner } = await import('./plan')
    const w = pickDeadlineWinner(
      [opt('b', 1, null), opt('a', 0, null)],
      new Map([['a', 1], ['b', 1]]),
    )
    expect(w?.id).toBe('a')
  })
})

// Lazy lifecycle transitions (close-plan-loop): deadline auto-strike/expire and struck -> completed.
// Same DB gate as the strike suite above.
describe.skipIf(!url)('plan lifecycle transitions (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
  })

  const HOUR = 3600_000

  async function fixtures(n: number) {
    const repo = await import('./repo')
    const plan = await import('./plan')
    const { newToken } = await import('../ids')
    const creator = await repo.createParticipant(newToken())
    const invitees = []
    for (let i = 0; i < n; i++) invitees.push(await repo.createParticipant(newToken()))
    return { repo, plan, newToken, creator, invitees }
  }

  // An open plan (threshold high enough that test picks never threshold-strike) with a deadline
  // and two options; option startsAt are relative to `now` so completion buffers are exact.
  async function deadlinePlan(now: Date, opts?: { timeless?: boolean }) {
    const { plan, newToken, creator, invitees } = await fixtures(4)
    const closesAt = new Date(now.getTime() + 1 * HOUR)
    const p = await plan.createPlan({
      token: newToken(), creatorParticipantId: creator.id,
      intentText: 'tennis saturday', confirmThreshold: 4, closesAt,
    })
    const [optA, optB] = await plan.setOptions(p.id, [
      { kind: 'time', label: 'Sat 10:00 AM', startsAt: opts?.timeless ? null : new Date(now.getTime() + 26 * HOUR), aiRank: 0 },
      { kind: 'time', label: 'Sun 4:00 PM', startsAt: opts?.timeless ? null : new Date(now.getTime() + 50 * HOUR), aiRank: 1 },
    ])
    const published = await plan.publishPlan(p.id, creator.id)
    expect(published?.state).toBe('open')
    return { plan, p: published!, optA: optA!, optB: optB!, invitees, closesAt }
  }

  it('deadline auto-strikes the option with the most availability', async () => {
    const now = new Date()
    const { plan, p, optA, optB, invitees } = await deadlinePlan(now)
    await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, now)
    await plan.recordAvailabilityAndMaybeStrike(p.id, optB.id, invitees[1]!.id, now)
    await plan.recordAvailabilityAndMaybeStrike(p.id, optB.id, invitees[2]!.id, now)
    const resolved = await plan.resolvePlanState(
      (await plan.getPlanById(p.id))!, new Date(now.getTime() + 2 * HOUR))
    expect(resolved.state).toBe('struck')
    expect(resolved.struckOptionId).toBe(optB.id)
    expect(resolved.struckAt).not.toBeNull()
  })

  it('deadline tie is broken by the earlier start', async () => {
    const now = new Date()
    const { plan, p, optA, optB, invitees } = await deadlinePlan(now)
    await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, now)
    await plan.recordAvailabilityAndMaybeStrike(p.id, optB.id, invitees[1]!.id, now)
    const resolved = await plan.resolvePlanState(
      (await plan.getPlanById(p.id))!, new Date(now.getTime() + 2 * HOUR))
    expect(resolved.state).toBe('struck')
    expect(resolved.struckOptionId).toBe(optA.id) // 26h out beats 50h out
  })

  it('zero selections at the deadline means expired', async () => {
    const now = new Date()
    const { plan, p } = await deadlinePlan(now)
    const resolved = await plan.resolvePlanState(
      (await plan.getPlanById(p.id))!, new Date(now.getTime() + 2 * HOUR))
    expect(resolved.state).toBe('expired')
    expect(resolved.struckOptionId).toBeNull()
  })

  it('an open plan before its deadline is left alone', async () => {
    const now = new Date()
    const { plan, p } = await deadlinePlan(now)
    const resolved = await plan.resolvePlanState((await plan.getPlanById(p.id))!, now)
    expect(resolved.state).toBe('open')
  })

  it('a struck plan completes after the winning start + buffer, not before', async () => {
    const now = new Date()
    const { plan, p, optA, invitees } = await deadlinePlan(now) // optA starts now+26h
    await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, now)
    const afterDeadline = new Date(now.getTime() + 2 * HOUR)
    const struck = await plan.resolvePlanState((await plan.getPlanById(p.id))!, afterDeadline)
    expect(struck.state).toBe('struck')
    // 26h + 4h buffer = due at now+30h. At +29h: still struck. At +31h: completed.
    const early = await plan.resolvePlanState(struck, new Date(now.getTime() + 29 * HOUR))
    expect(early.state).toBe('struck')
    const done = await plan.resolvePlanState(early, new Date(now.getTime() + 31 * HOUR))
    expect(done.state).toBe('completed')
  })

  it('a timeless winner falls back to strike + 24h', async () => {
    const now = new Date()
    const { plan, p, optA, invitees } = await deadlinePlan(now, { timeless: true })
    await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, now)
    const strikeAt = new Date(now.getTime() + 2 * HOUR)
    const struck = await plan.resolvePlanState((await plan.getPlanById(p.id))!, strikeAt)
    expect(struck.state).toBe('struck')
    const early = await plan.resolvePlanState(struck, new Date(strikeAt.getTime() + 23 * HOUR))
    expect(early.state).toBe('struck')
    const done = await plan.resolvePlanState(early, new Date(strikeAt.getTime() + 25 * HOUR))
    expect(done.state).toBe('completed')
  })

  it('completion is idempotent: a second resolve is a no-op', async () => {
    const now = new Date()
    const { plan, p, optA, invitees } = await deadlinePlan(now)
    await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, now)
    const late = new Date(now.getTime() + 40 * HOUR) // past deadline AND past start+buffer
    const first = await plan.resolvePlanState((await plan.getPlanById(p.id))!, late)
    expect(first.state).toBe('completed') // strike + completion chain in one read
    const versionAfter = first.version
    const second = await plan.resolvePlanState(first, late)
    expect(second.state).toBe('completed')
    const fresh = (await plan.getPlanById(p.id))!
    expect(fresh.state).toBe('completed')
    expect(fresh.version).toBe(versionAfter) // no extra transition hit the DB
  })

  // The batched dash read must match the per-plan path: same states, winner labels, ember
  // visibility, and the same lazy healing a link visit would perform.
  it('dashPlansForCreator carries state, winner label, ember, and heals due plans', async () => {
    const repo = await import('./repo')
    const plan = await import('./plan')
    const ember = await import('./ember')
    const { newToken } = await import('../ids')
    const now = new Date()
    const dashNow = new Date(now.getTime() + 2 * HOUR)
    const creator = await repo.createParticipant(newToken())
    const invitee = await repo.createParticipant(newToken())

    // A: open, no deadline — the dash leaves it alone.
    const a = await plan.createPlan({
      token: newToken(), creatorParticipantId: creator.id, intentText: 'Still open',
    })
    await plan.setOptions(a.id, [
      { kind: 'time_place', label: 'Later', startsAt: new Date(now.getTime() + 72 * HOUR) },
    ])
    await plan.publishPlan(a.id, creator.id)

    // B: deadline already past at dash time, one pick — the dash visit itself strikes it.
    const b = await plan.createPlan({
      token: newToken(), creatorParticipantId: creator.id, intentText: 'Due plan',
      closesAt: new Date(now.getTime() + HOUR),
    })
    const [bOpt] = await plan.setOptions(b.id, [
      { kind: 'time_place', label: 'Winner slot', startsAt: new Date(now.getTime() + 26 * HOUR) },
    ])
    await plan.publishPlan(b.id, creator.id)
    await plan.recordAvailabilityAndMaybeStrike(b.id, bOpt!.id, invitee.id, now)

    // C: completed before the dash, ember tapped by both — mutual for the creator.
    const c = await plan.createPlan({
      token: newToken(), creatorParticipantId: creator.id, intentText: 'Done plan',
      closesAt: new Date(now.getTime() + HOUR),
    })
    const [cOpt] = await plan.setOptions(c.id, [{ kind: 'time', label: 'Sometime', startsAt: null }])
    await plan.publishPlan(c.id, creator.id)
    await plan.recordAvailabilityAndMaybeStrike(c.id, cOpt!.id, creator.id, now)
    const cStruck = await plan.resolvePlanState((await plan.getPlanById(c.id))!, dashNow)
    expect(cStruck.state).toBe('struck')
    const cDone = await plan.resolvePlanState(cStruck, new Date(dashNow.getTime() + 25 * HOUR))
    expect(cDone.state).toBe('completed')
    await ember.tapEmber(cDone, creator.id)
    await ember.tapEmber(cDone, invitee.id)

    const dash = await plan.dashPlansForCreator(creator.id, dashNow)
    const byToken = new Map(dash.map((p) => [p.token, p]))

    expect(byToken.get(a.token)).toMatchObject({ state: 'open', winnerLabel: null, ember: null })
    expect(byToken.get(b.token)).toMatchObject({ state: 'struck', winnerLabel: 'Winner slot', ember: null })
    expect(byToken.get(c.token)).toMatchObject({
      state: 'completed', winnerLabel: 'Sometime',
      ember: { tapped: true, mutual: true, coTappers: ['someone'] }, // invitee has no display name
    })
    // The dash's healing persisted — B is struck in the DB, not just in the payload.
    expect((await plan.getPlanById(b.id))!.state).toBe('struck')
  })

  // Race-safety needs real concurrent connections; gated like the strike concurrency test above.
  it.skipIf(!process.env.TEST_PG_CONCURRENCY)('racing resolves transition exactly once', async () => {
    const now = new Date()
    const { plan, p, optA, invitees } = await deadlinePlan(now)
    await plan.recordAvailabilityAndMaybeStrike(p.id, optA.id, invitees[0]!.id, now)
    const late = new Date(now.getTime() + 2 * HOUR)
    const stale = (await plan.getPlanById(p.id))!
    const beforeVersion = Number(stale.version)
    const [r1, r2] = await Promise.all([
      plan.resolvePlanState(stale, late),
      plan.resolvePlanState(stale, late),
    ])
    expect(r1.state).toBe('struck')
    expect(r2.state).toBe('struck')
    expect(r1.struckOptionId).toBe(optA.id)
    expect(r2.struckOptionId).toBe(optA.id)
    const after = (await plan.getPlanById(p.id))!
    expect(Number(after.version)).toBe(beforeVersion + 1) // one transition, not two
  })
})

import { describe, it, expect, beforeAll } from 'vitest'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('repo integration (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => { process.env.DATABASE_URL = url })

  it('strike fires exactly once under concurrent replies', async () => {
    const repo = await import('./repo')
    const { newToken } = await import('./ids')
    const now = new Date()
    const circle = await repo.createCircle(`itest-${Date.now()}`, 2)
    const members = await Promise.all(
      ['A', 'B', 'C', 'D'].map((n, i) =>
        repo.insertMember(circle.id, n, `+1917555${String(1000 + i)}`, newToken())),
    )
    const round = await repo.insertRound({
      circleId: circle.id, verbEmoji: '🍜', verbLabel: 'dinner',
      proposedAt: new Date(now.getTime() + 48 * 3600_000),
      closesAt: new Date(now.getTime() + 46 * 3600_000),
      detail: null, source: 'scheduled', state: 'open', cadenceSlot: null,
    })
    expect(round).not.toBeNull()
    // 4 simultaneous 'in' replies against K=2: exactly one must observe the strike
    const results = await Promise.all(
      members.map((m) => repo.replyAndMaybeStrike(round!.id, m.id, 'in', now)),
    )
    const strikes = results.filter((r) => r.kind === 'struck')
    expect(strikes).toHaveLength(1)
    const after = await repo.getRound(round!.id)
    expect(after!.state).toBe('struck')
    const attendance = await repo.attendanceForEvent((strikes[0] as any).eventId)
    expect(attendance.length).toBeGreaterThanOrEqual(2)
  })

  it('closed rounds reject replies', async () => {
    const repo = await import('./repo')
    const { newToken } = await import('./ids')
    const now = new Date()
    const circle = await repo.createCircle(`itest2-${Date.now()}`, 2)
    const m = await repo.insertMember(circle.id, 'A', '+19175552000', newToken())
    const round = await repo.insertRound({
      circleId: circle.id, verbEmoji: '☕', verbLabel: 'coffee',
      proposedAt: new Date(now.getTime() - 3600_000), closesAt: new Date(now.getTime() - 7200_000),
      detail: null, source: 'scheduled', state: 'open', cadenceSlot: null,
    })
    const res = await repo.replyAndMaybeStrike(round!.id, m.id, 'in', now)
    expect(res.kind).toBe('closed')
  })
})

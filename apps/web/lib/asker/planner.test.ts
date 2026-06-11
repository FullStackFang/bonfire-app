import { describe, it, expect } from 'vitest'
import { planScheduledRounds, planKindleRelease, planHoldDecision } from './planner'
import type { Circle, Round } from './types'

const TUE_1705 = new Date('2026-06-09T21:05:00Z') // Tue 17:05 NY
const circle: Circle = {
  id: 'c1', name: 'Park Slope', kThreshold: 2,
  verbSet: [
    { emoji: '🍜', label: 'dinner' }, { emoji: '☕', label: 'coffee' },
    { emoji: '🏃', label: 'move' }, { emoji: '📺', label: 'couch' },
  ],
  cadence: [
    { askDow: 2, askHour: 17, verb: 'rotate', proposeDow: 4, proposeHour: 19 },
    { askDow: 0, askHour: 11, verb: '☕', proposeDow: 6, proposeHour: 11 },
  ],
}

describe('planScheduledRounds', () => {
  it('creates a round when inside an ask window and the slot is unused', () => {
    const out = planScheduledRounds(circle, TUE_1705, new Set(), 0)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      circleId: 'c1', verbEmoji: '🍜', verbLabel: 'dinner',
      source: 'scheduled', state: 'open', cadenceSlot: '2026-W24-t0',
    })
    expect(out[0].proposedAt.toISOString()).toBe('2026-06-11T23:00:00.000Z') // Thu 19:00 EDT
    expect(out[0].closesAt.toISOString()).toBe('2026-06-11T21:00:00.000Z') // -2h
  })
  it('rotates verbs by prior scheduled count', () => {
    const out = planScheduledRounds(circle, TUE_1705, new Set(), 5) // 5 % 4 = 1 -> coffee
    expect(out[0].verbEmoji).toBe('☕')
  })
  it('is idempotent via used slots', () => {
    expect(planScheduledRounds(circle, TUE_1705, new Set(['2026-W24-t0']), 0)).toHaveLength(0)
  })
  it('does nothing outside ask windows', () => {
    expect(planScheduledRounds(circle, new Date('2026-06-10T21:05:00Z'), new Set(), 0)).toHaveLength(0)
  })
  it('fixed-verb templates use that verb', () => {
    const sun11 = new Date('2026-06-14T15:30:00Z') // Sun 11:30 NY
    const out = planScheduledRounds(circle, sun11, new Set(), 0)
    expect(out[0].verbEmoji).toBe('☕')
    expect(out[0].cadenceSlot).toBe('2026-W24-t1')
  })
})

describe('planKindleRelease', () => {
  const queued = (id: string, createdAgoMin: number): Round => ({
    id, circleId: 'c1', verbEmoji: '🏃', verbLabel: 'move',
    proposedAt: new Date('2026-06-11T23:00:00Z'), closesAt: new Date('2026-06-11T21:00:00Z'),
    detail: null, source: 'kindled', state: 'queued', cadenceSlot: null,
  })
  it('releases the oldest queued kindle inside a window, one per tick', () => {
    expect(planKindleRelease(circle, TUE_1705, [queued('k1', 60), queued('k2', 5)], 0, 0)).toEqual(['k1'])
  })
  it('respects 1/day and 3/week circle caps', () => {
    expect(planKindleRelease(circle, TUE_1705, [queued('k1', 60)], 1, 1)).toEqual([])
    expect(planKindleRelease(circle, TUE_1705, [queued('k1', 60)], 0, 3)).toEqual([])
  })
  it('holds kindles outside windows', () => {
    expect(planKindleRelease(circle, new Date('2026-06-10T21:05:00Z'), [queued('k1', 60)], 0, 0)).toEqual([])
  })
})

describe('planHoldDecision', () => {
  it('fells through below 2 confirmed, holds at 2+', () => {
    expect(planHoldDecision(['confirmed', 'in', 'out'] as any)).toBe(true) // 1 confirmed -> fell through
    expect(planHoldDecision(['confirmed', 'confirmed', 'in'] as any)).toBe(false)
  })
})

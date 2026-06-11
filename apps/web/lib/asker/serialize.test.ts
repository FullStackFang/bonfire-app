import { describe, it, expect } from 'vitest'
import { serializeRound } from './serialize'
import type { Round } from './types'

const base: Omit<Round, 'source'> = {
  id: 'r1', circleId: 'c1', verbEmoji: '🍜', verbLabel: 'dinner',
  proposedAt: new Date('2026-06-11T23:00:00Z'), closesAt: new Date('2026-06-11T21:00:00Z'),
  detail: 'that new place on 5th', state: 'open', cadenceSlot: '2026-W24-t0',
}

describe('serializeRound — secrecy invariants', () => {
  it('never serializes source, cadenceSlot, or any count field', () => {
    const out = serializeRound({ ...base, source: 'kindled' }, 'in')
    expect(out).not.toHaveProperty('source')
    expect(out).not.toHaveProperty('cadenceSlot')
    expect(JSON.stringify(out)).not.toMatch(/count|inCount|replies/i)
  })
  it('kindled and scheduled rounds are byte-identical apart from ids', () => {
    const a = serializeRound({ ...base, source: 'kindled' }, null)
    const b = serializeRound({ ...base, source: 'scheduled' }, null)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
  it('exposes only the viewer own answer', () => {
    expect(serializeRound({ ...base, source: 'scheduled' }, 'later').myAnswer).toBe('later')
    expect(serializeRound({ ...base, source: 'scheduled' }, null).myAnswer).toBeNull()
  })
  it('throws on queued rounds — they are invisible by definition', () => {
    expect(() => serializeRound({ ...base, source: 'kindled', state: 'queued' }, null))
      .toThrow('queued rounds are not visible')
  })
})

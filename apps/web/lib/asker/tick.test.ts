import { describe, it, expect } from 'vitest'
import { t0Recipients } from './tick'
import type { Attendance } from './types'

const att = (memberId: string, state: Attendance['state']): Attendance =>
  ({ eventId: 'e1', memberId, state, etaMinutes: null })

describe('t0Recipients', () => {
  it('nudges in/confirmed members who are not yet walking or there', () => {
    const rows = [att('a', 'in'), att('b', 'confirmed'), att('c', 'omw'), att('d', 'here'), att('e', 'out')]
    expect(t0Recipients(rows)).toEqual(['a', 'b'])
  })
})

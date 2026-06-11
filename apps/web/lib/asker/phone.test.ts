import { describe, it, expect } from 'vitest'
import { normalizeUsPhone } from './phone'

describe('normalizeUsPhone', () => {
  it('accepts 10-digit US numbers in common formats', () => {
    expect(normalizeUsPhone('(917) 555-0142')).toBe('+19175550142')
    expect(normalizeUsPhone('917.555.0142')).toBe('+19175550142')
    expect(normalizeUsPhone('9175550142')).toBe('+19175550142')
  })
  it('accepts 11-digit with leading 1 and +1 form', () => {
    expect(normalizeUsPhone('1 917 555 0142')).toBe('+19175550142')
    expect(normalizeUsPhone('+1 (917) 555-0142')).toBe('+19175550142')
  })
  it('rejects everything else', () => {
    expect(normalizeUsPhone('555-0142')).toBeNull()
    expect(normalizeUsPhone('+44 20 7946 0958')).toBeNull()
    expect(normalizeUsPhone('not a phone')).toBeNull()
  })
})

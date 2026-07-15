import { describe, it, expect } from 'vitest'
import { isLive, resolveExpiry, expiresClock } from './time'
import { TTL_PRESETS } from './copy'

const future = (ms: number) => new Date(Date.now() + ms)
const past = (ms: number) => new Date(Date.now() - ms)

describe('isLive', () => {
  const now = new Date()
  it('is live when unwrapped and before expiry', () => {
    expect(isLive({ closedAt: null, expiresAt: future(3_600_000) }, now)).toBe(true)
  })
  it('is not live once expired', () => {
    expect(isLive({ closedAt: null, expiresAt: past(1_000) }, now)).toBe(false)
  })
  it('is not live once wrapped, even before expiry', () => {
    expect(isLive({ closedAt: past(1_000), expiresAt: future(3_600_000) }, now)).toBe(false)
  })
})

describe('resolveExpiry', () => {
  const now = new Date('2026-06-30T15:00:00') // local

  it('duration preset adds the hours', () => {
    const p = TTL_PRESETS.find((x) => x.key === '3h')!
    expect(resolveExpiry(p, now).getTime()).toBe(now.getTime() + 3 * 3_600_000)
  })

  it('end-of-today resolves to a future local end of day', () => {
    const p = TTL_PRESETS.find((x) => x.key === 'eod')!
    const r = resolveExpiry(p, now)
    expect(r.getTime()).toBeGreaterThan(now.getTime())
    expect(r.getHours()).toBe(23)
    expect(r.getDate()).toBe(now.getDate())
  })

  it('end-of-tomorrow lands on the next local day', () => {
    const p = TTL_PRESETS.find((x) => x.key === 'tomorrow')!
    const r = resolveExpiry(p, now)
    expect(r.getDate()).toBe(new Date(now.getTime() + 86_400_000).getDate())
    expect(r.getHours()).toBe(23)
  })

  it('never returns a past instant for end-of-day late at night', () => {
    const late = new Date('2026-06-30T23:59:59.800')
    const p = TTL_PRESETS.find((x) => x.key === 'eod')!
    expect(resolveExpiry(p, late).getTime()).toBeGreaterThan(late.getTime())
  })
})

describe('expiresClock', () => {
  it('renders a short lowercase clock label', () => {
    expect(expiresClock(new Date('2026-06-30T20:30:00'))).toMatch(/^\d{1,2}:\d{2}[ap]m$/)
  })
})

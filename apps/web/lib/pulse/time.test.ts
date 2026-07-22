import { describe, it, expect } from 'vitest'
import { isLive, resolveWhen, deriveWhenLabel, startsLabel, remainingLabel, expiresClock } from './time'

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

describe('resolveWhen', () => {
  const now = new Date('2026-06-30T15:00:00') // local, mid-afternoon

  it('Now mode starts at now and adds the duration', () => {
    const { startAt, endsAt } = resolveWhen('now', '2h', null, now)
    expect(startAt.getTime()).toBe(now.getTime())
    expect(endsAt.getTime()).toBe(now.getTime() + 2 * 3_600_000)
  })

  it('Now + til late ends at end of the local day', () => {
    const { startAt, endsAt } = resolveWhen('now', 'late', null, now)
    expect(startAt.getTime()).toBe(now.getTime())
    expect(endsAt.getHours()).toBe(23)
    expect(endsAt.getMinutes()).toBe(59)
    expect(endsAt.getDate()).toBe(now.getDate())
  })

  it('Later mode resolves the picked day + time to a local wall-clock start', () => {
    const { startAt, endsAt } = resolveWhen('later', '2h', { day: 'today', hour: 20, minute: 30 }, now)
    expect(startAt.getHours()).toBe(20)
    expect(startAt.getMinutes()).toBe(30)
    expect(startAt.getDate()).toBe(now.getDate())
    expect(endsAt.getTime()).toBe(startAt.getTime() + 2 * 3_600_000)
  })

  it('Later + tomorrow lands on the next local day', () => {
    const { startAt } = resolveWhen('later', '1h', { day: 'tomorrow', hour: 21, minute: 0 }, now)
    expect(startAt.getDate()).toBe(new Date(now.getTime() + 86_400_000).getDate())
    expect(startAt.getHours()).toBe(21)
  })

  it('Later + til late ends at end of the START day, not the creation day', () => {
    const { startAt, endsAt } = resolveWhen('later', 'late', { day: 'tomorrow', hour: 21, minute: 0 }, now)
    expect(endsAt.getDate()).toBe(startAt.getDate())
    expect(endsAt.getHours()).toBe(23)
    expect(endsAt.getTime()).toBeGreaterThan(startAt.getTime())
  })

  it('a past Later-today pick still resolves (client refuses it; server validates end > now)', () => {
    // resolveWhen is pure — it does not reject a past start; the form disables submit and the API
    // enforces endsAt > now. It just resolves the picked wall clock.
    const { startAt } = resolveWhen('later', '2h', { day: 'today', hour: 9, minute: 0 }, now)
    expect(startAt.getHours()).toBe(9)
    expect(startAt.getTime()).toBeLessThan(now.getTime())
  })
})

describe('deriveWhenLabel', () => {
  const tz = 'America/New_York'
  // A fixed "now" in NY (2026-06-30 15:00 EDT = 19:00Z).
  const now = new Date('2026-06-30T19:00:00Z')

  it('labels a Now pulse from its instants', () => {
    const startAt = now
    const endsAt = new Date(now.getTime() + 2 * 3_600_000)
    expect(deriveWhenLabel(startAt, endsAt, tz, now)).toBe('Now · ~2h')
  })

  it('labels a later-tonight pulse with its clock time', () => {
    const startAt = new Date('2026-07-01T00:30:00Z') // 8:30pm EDT, same NY day as `now`
    const endsAt = new Date(startAt.getTime() + 2 * 3_600_000)
    expect(deriveWhenLabel(startAt, endsAt, tz, now)).toBe('Tonight 8:30pm · ~2h')
  })

  it('labels a tomorrow pulse with a til-late run', () => {
    const startAt = new Date('2026-07-02T01:00:00Z') // 9:00pm EDT on Jul 1 (tomorrow in NY)
    const endsAt = new Date('2026-07-02T03:59:59.999Z') // 11:59pm EDT Jul 1 — end of the start's day
    expect(deriveWhenLabel(startAt, endsAt, tz, now)).toBe('Tomorrow 9pm · til late')
  })
})

describe('startsLabel / remainingLabel', () => {
  const now = new Date()
  it('starts in N minutes under an hour', () => {
    expect(startsLabel(new Date(now.getTime() + 20 * 60_000), now)).toBe('starts in 20 min')
  })
  it('starts at a clock time beyond an hour', () => {
    expect(startsLabel(new Date(now.getTime() + 3 * 3_600_000), now)).toMatch(/^starts at \d{1,2}(:\d{2})?[ap]m$/)
  })
  it('remaining minutes under an hour', () => {
    expect(remainingLabel(new Date(now.getTime() + 45 * 60_000), now)).toBe('for another 45 min')
  })
  it('remaining hours beyond an hour', () => {
    expect(remainingLabel(new Date(now.getTime() + 2 * 3_600_000), now)).toBe('for another 2 hrs')
  })
})

describe('expiresClock', () => {
  it('renders a short lowercase clock label', () => {
    expect(expiresClock(new Date('2026-06-30T20:30:00'))).toMatch(/^\d{1,2}:\d{2}[ap]m$/)
  })
})

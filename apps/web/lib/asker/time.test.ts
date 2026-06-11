import { describe, it, expect } from 'vitest'
import {
  nyParts, nyDayKey, isoWeek, slotKey, zonedNyToUtc,
  nextOccurrence, matchesAskWindow, nyDayStartUtc, nyWeekStartUtc,
} from './time'

// Tue Jun 9 2026 17:05 EDT == 21:05Z
const TUE_1705 = new Date('2026-06-09T21:05:00Z')

describe('nyParts', () => {
  it('converts UTC instants to NY wall clock (EDT)', () => {
    expect(nyParts(TUE_1705)).toMatchObject({ dow: 2, hour: 17, minute: 5 })
  })
  it('handles EST (winter)', () => {
    // Mon Jan 12 2026 09:30 EST == 14:30Z
    expect(nyParts(new Date('2026-01-12T14:30:00Z'))).toMatchObject({ dow: 1, hour: 9, minute: 30 })
  })
})

describe('zonedNyToUtc', () => {
  it('builds the UTC instant for an NY wall time (EDT)', () => {
    expect(zonedNyToUtc(2026, 6, 11, 19, 0).toISOString()).toBe('2026-06-11T23:00:00.000Z')
  })
  it('builds the UTC instant for an NY wall time (EST)', () => {
    expect(zonedNyToUtc(2026, 1, 15, 19, 0).toISOString()).toBe('2026-01-16T00:00:00.000Z')
  })
})

describe('nextOccurrence', () => {
  it('finds the next Thu 19:00 NY after a Tuesday evening', () => {
    expect(nextOccurrence(TUE_1705, 4, 19).toISOString()).toBe('2026-06-11T23:00:00.000Z')
  })
  it('rolls to next week when the slot already passed', () => {
    // Fri Jun 12 2026 10:00 EDT
    const fri = new Date('2026-06-12T14:00:00Z')
    expect(nextOccurrence(fri, 4, 19).toISOString()).toBe('2026-06-18T23:00:00.000Z')
  })
  it('same-day later hour counts as next occurrence', () => {
    expect(nextOccurrence(TUE_1705, 2, 19).toISOString()).toBe('2026-06-09T23:00:00.000Z')
  })
})

describe('matchesAskWindow', () => {
  const t = { askDow: 2, askHour: 17, verb: 'rotate', proposeDow: 4, proposeHour: 19 }
  it('matches within two hours after the slot (jitter tolerance)', () => {
    expect(matchesAskWindow(t, TUE_1705)).toBe(true)
    expect(matchesAskWindow(t, new Date('2026-06-09T22:01:00Z'))).toBe(true) // 18:01 NY — delayed tick still fires
  })
  it('does not match before the slot or after the window', () => {
    expect(matchesAskWindow(t, new Date('2026-06-09T20:59:00Z'))).toBe(false) // 16:59 NY
    expect(matchesAskWindow(t, new Date('2026-06-09T23:05:00Z'))).toBe(false) // 19:05 NY
    expect(matchesAskWindow(t, new Date('2026-06-10T21:05:00Z'))).toBe(false) // Wed
  })
})

describe('keys', () => {
  it('nyDayKey is the NY calendar date', () => {
    // 01:30Z Wed = 21:30 EDT Tue -> still Tuesday in NY
    expect(nyDayKey(new Date('2026-06-10T01:30:00Z'))).toBe('2026-06-09')
  })
  it('isoWeek + slotKey', () => {
    expect(isoWeek(TUE_1705)).toBe('2026-W24')
    expect(slotKey('2026-W24', 0)).toBe('2026-W24-t0')
  })
  it('day/week starts as UTC instants', () => {
    expect(nyDayStartUtc(TUE_1705).toISOString()).toBe('2026-06-09T04:00:00.000Z')
    // week starts Monday in NY: Mon Jun 8 00:00 EDT
    expect(nyWeekStartUtc(TUE_1705).toISOString()).toBe('2026-06-08T04:00:00.000Z')
  })
})

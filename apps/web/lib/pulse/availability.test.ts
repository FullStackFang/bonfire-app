import { describe, it, expect } from 'vitest'
import { resolveAvailability, type ResolveInput } from './availability'

// Pure-function coverage for the resolution order and the timezone edges. All baselines here
// are America/New_York; absolute instants are written in UTC (NY is UTC-4 in July / EDT,
// UTC-5 before March 8 2026 / EST — the 2026 spring-forward is Sun Mar 8, 02:00→03:00).
// 2026-07-16 is a Thursday.

const NY = 'America/New_York'
const workBaseline = {
  daysOfWeek: [1, 2, 3, 4], // Mon–Thu
  startTime: '09:00', endTime: '17:30', timezone: NY, label: 'work',
}

const base = (over: Partial<ResolveInput>): ResolveInput => ({
  baselines: [], exceptions: [], calendarBlocks: [],
  window: { startsAt: new Date('2026-07-16T19:00:00Z'), endsAt: new Date('2026-07-16T20:00:00Z') },
  ...over,
})

describe('resolveAvailability', () => {
  it('baseline overlap → busy with label', () => {
    // Thu 15:00–16:00 NY, inside Mon–Thu 09:00–17:30
    const r = resolveAvailability(base({ baselines: [workBaseline] }))
    expect(r).toEqual({ availability: 'busy', confidence: 'high', label: 'work' })
  })

  it('baselines declared but no overlap → probably_free at low confidence', () => {
    // Thu 19:00–21:00 NY (23:00–01:00 UTC), after work
    const r = resolveAvailability(base({
      baselines: [workBaseline],
      window: { startsAt: new Date('2026-07-16T23:00:00Z'), endsAt: new Date('2026-07-17T01:00:00Z') },
    }))
    expect(r).toEqual({ availability: 'probably_free', confidence: 'low' })
  })

  it('day-of-week outside the baseline does not overlap', () => {
    // Saturday 15:00 NY — same clock time, wrong day
    const r = resolveAvailability(base({
      baselines: [workBaseline],
      window: { startsAt: new Date('2026-07-18T19:00:00Z'), endsAt: new Date('2026-07-18T20:00:00Z') },
    }))
    expect(r).toEqual({ availability: 'probably_free', confidence: 'low' })
  })

  it('free exception over a busy baseline → free at low confidence', () => {
    // "I'm free" declared over Thursday work hours
    const r = resolveAvailability(base({
      baselines: [workBaseline],
      exceptions: [{
        state: 'free',
        startsAt: new Date('2026-07-16T13:00:00Z'), endsAt: new Date('2026-07-16T21:30:00Z'),
        label: null,
      }],
    }))
    expect(r).toEqual({ availability: 'free', confidence: 'low' })
  })

  it('busy exception carries its label', () => {
    const r = resolveAvailability(base({
      exceptions: [{
        state: 'busy',
        startsAt: new Date('2026-07-16T18:00:00Z'), endsAt: new Date('2026-07-16T21:00:00Z'),
        label: 'dentist',
      }],
    }))
    expect(r).toEqual({ availability: 'busy', confidence: 'high', label: 'dentist' })
  })

  it('the latest overlapping correction wins', () => {
    const r = resolveAvailability(base({
      exceptions: [
        {
          state: 'busy', label: 'dentist',
          startsAt: new Date('2026-07-16T18:00:00Z'), endsAt: new Date('2026-07-16T21:00:00Z'),
          createdAt: new Date('2026-07-10T00:00:00Z'),
        },
        {
          state: 'free', label: null,
          startsAt: new Date('2026-07-16T18:00:00Z'), endsAt: new Date('2026-07-16T21:00:00Z'),
          createdAt: new Date('2026-07-15T00:00:00Z'), // corrected later: actually free
        },
      ],
    }))
    expect(r).toEqual({ availability: 'free', confidence: 'low' })
  })

  it('multi-day vacation range: every window inside resolves busy with the label', () => {
    const vacation = {
      state: 'busy' as const, label: 'vacation',
      // all-day Mon Jul 20 → Fri Jul 24, NY days (EDT = UTC-4)
      startsAt: new Date('2026-07-20T04:00:00Z'), endsAt: new Date('2026-07-25T04:00:00Z'),
    }
    for (const day of ['2026-07-20', '2026-07-22', '2026-07-24']) {
      const r = resolveAvailability(base({
        baselines: [workBaseline],
        exceptions: [vacation],
        window: { startsAt: new Date(`${day}T23:00:00Z`), endsAt: new Date(`${day}T23:59:00Z`) },
      }))
      expect(r).toEqual({ availability: 'busy', confidence: 'high', label: 'vacation' })
    }
    // The Saturday after the range is back to normal
    const after = resolveAvailability(base({
      baselines: [workBaseline], exceptions: [vacation],
      window: { startsAt: new Date('2026-07-25T23:00:00Z'), endsAt: new Date('2026-07-25T23:59:00Z') },
    }))
    expect(after).toEqual({ availability: 'probably_free', confidence: 'low' })
  })

  it('an all-day exception covers any window that day', () => {
    // all-day busy Thu Jul 16, NY bounds (00:00–24:00 EDT = 04:00–04:00 UTC)
    const r = resolveAvailability(base({
      exceptions: [{
        state: 'busy', label: 'offsite',
        startsAt: new Date('2026-07-16T04:00:00Z'), endsAt: new Date('2026-07-17T04:00:00Z'),
      }],
      window: { startsAt: new Date('2026-07-16T23:30:00Z'), endsAt: new Date('2026-07-17T01:00:00Z') },
    }))
    expect(r).toEqual({ availability: 'busy', confidence: 'high', label: 'offsite' })
  })

  it('nothing declared → unknown', () => {
    const r = resolveAvailability(base({}))
    expect(r.availability).toBe('unknown')
  })

  it('exceptions alone do not make other windows probably_free — still unknown', () => {
    const r = resolveAvailability(base({
      exceptions: [{
        state: 'free',
        startsAt: new Date('2026-07-01T00:00:00Z'), endsAt: new Date('2026-07-02T00:00:00Z'),
        label: null,
      }],
    }))
    expect(r.availability).toBe('unknown')
  })

  it('midnight-spanning baseline window: the early-morning side of the NEXT day is busy', () => {
    // Fri 22:00–02:00 NY. Sat 01:00–01:30 NY = 05:00–05:30 UTC — inside the Friday window.
    const nightShift = { daysOfWeek: [5], startTime: '22:00', endTime: '02:00', timezone: NY, label: 'closing shift' }
    const r = resolveAvailability(base({
      baselines: [nightShift],
      window: { startsAt: new Date('2026-07-18T05:00:00Z'), endsAt: new Date('2026-07-18T05:30:00Z') },
    }))
    expect(r).toEqual({ availability: 'busy', confidence: 'high', label: 'closing shift' })
    // Saturday 22:30 NY is NOT a Friday occurrence
    const off = resolveAvailability(base({
      baselines: [nightShift],
      window: { startsAt: new Date('2026-07-19T02:30:00Z'), endsAt: new Date('2026-07-19T03:00:00Z') },
    }))
    expect(off).toEqual({ availability: 'probably_free', confidence: 'low' })
  })

  it('DST boundary: the same wall-clock baseline holds across spring-forward', () => {
    const evenings = { daysOfWeek: [1, 5], startTime: '18:00', endTime: '20:00', timezone: NY, label: 'class' }
    // Fri Mar 6 2026, 18:30 EST = 23:30 UTC (before the Mar 8 spring-forward)
    const before = resolveAvailability(base({
      baselines: [evenings],
      window: { startsAt: new Date('2026-03-06T23:30:00Z'), endsAt: new Date('2026-03-07T00:00:00Z') },
    }))
    expect(before).toEqual({ availability: 'busy', confidence: 'high', label: 'class' })
    // Mon Mar 9 2026, 18:30 EDT = 22:30 UTC (after)
    const after = resolveAvailability(base({
      baselines: [evenings],
      window: { startsAt: new Date('2026-03-09T22:30:00Z'), endsAt: new Date('2026-03-09T23:00:00Z') },
    }))
    expect(after).toEqual({ availability: 'busy', confidence: 'high', label: 'class' })
    // 18:30 UTC on Mar 9 is 14:30 NY — outside the window either way
    const outside = resolveAvailability(base({
      baselines: [evenings],
      window: { startsAt: new Date('2026-03-09T18:30:00Z'), endsAt: new Date('2026-03-09T19:00:00Z') },
    }))
    expect(outside).toEqual({ availability: 'probably_free', confidence: 'low' })
  })

  it('calendar branch exists: an overlapping block resolves busy at high confidence', () => {
    const r = resolveAvailability(base({
      baselines: [workBaseline],
      calendarBlocks: [{
        startsAt: new Date('2026-07-16T19:00:00Z'), endsAt: new Date('2026-07-16T20:00:00Z'), label: 'meeting',
      }],
      exceptions: [{ // calendar outranks even an exception
        state: 'free', startsAt: new Date('2026-07-16T18:00:00Z'), endsAt: new Date('2026-07-16T21:00:00Z'), label: null,
      }],
    }))
    expect(r).toEqual({ availability: 'busy', confidence: 'high', label: 'meeting' })
  })
})

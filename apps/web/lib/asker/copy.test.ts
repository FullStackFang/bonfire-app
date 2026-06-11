import { describe, it, expect } from 'vitest'
import { whenLabel, whenShort, joinNames, copy } from './copy'

// Thu Jun 11 2026 19:00 EDT == 23:00Z
const THU_7PM = new Date('2026-06-11T23:00:00.000Z')
// "now" on Tuesday that week
const TUE = new Date('2026-06-09T21:05:00.000Z')
// "now" on Thursday afternoon (same NY day as the event)
const THU_2PM = new Date('2026-06-11T18:00:00.000Z')

describe('whenLabel / whenShort', () => {
  it('future day uses the day name', () => {
    expect(whenLabel(THU_7PM, TUE)).toBe('Thursday night')
    expect(whenShort(THU_7PM, TUE)).toBe('Thursday 7pm')
  })
  it('same NY day becomes tonight/today', () => {
    expect(whenLabel(THU_7PM, THU_2PM)).toBe('tonight')
    expect(whenShort(THU_7PM, THU_2PM)).toBe('tonight 7pm')
    const thuNoon = new Date('2026-06-11T16:00:00.000Z') // noon EDT
    expect(whenLabel(thuNoon, THU_2PM)).toBe('today')
    expect(whenShort(thuNoon, THU_2PM)).toBe('today 12pm')
  })
  it('dayparts', () => {
    expect(whenLabel(new Date('2026-06-11T15:00:00.000Z'), TUE)).toBe('Thursday morning') // 11am
    expect(whenLabel(new Date('2026-06-11T19:00:00.000Z'), TUE)).toBe('Thursday afternoon') // 3pm
  })
})

describe('joinNames', () => {
  it('formats 1, 2, 3, many', () => {
    expect(joinNames(['Maya'])).toBe('Maya')
    expect(joinNames(['Maya', 'Dev'])).toBe('Maya and Dev')
    expect(joinNames(['Maya', 'Dev', 'Sam'])).toBe('Maya, Dev and Sam')
    expect(joinNames(['Maya', 'Dev', 'Sam', 'Jo', 'Ash'])).toBe('Maya, Dev and 3 more')
  })
})

describe('copy — frozen canon (spec v3.0 table)', () => {
  const L = 'https://b.test/t/abc/r/r1'
  it('ask', () => {
    expect(copy.ask('🍜', THU_7PM, TUE, L))
      .toBe("🍜 Thursday night — anyone? Nobody sees your answer till it's on. → " + L)
  })
  it('strike, both variants', () => {
    expect(copy.strikeIn('🍜', THU_7PM, TUE, ['Maya', 'Dev'], L))
      .toBe("It's ON: 🍜 Thursday 7pm — you, Maya and Dev. → " + L)
    expect(copy.strikeJoin('🍜', THU_7PM, TUE, ['Maya', 'Dev'], L))
      .toBe("It's ON: 🍜 Thursday 7pm. Maya and Dev are in — join? → " + L)
    expect(copy.strikeJoin('🍜', THU_7PM, TUE, ['Maya'], L))
      .toBe("It's ON: 🍜 Thursday 7pm. Maya is in — join? → " + L)
  })
  it('hold', () => {
    expect(copy.hold('🍜', THU_7PM, THU_2PM, L)).toBe('tonight 7pm: 🍜 — still in? → ' + L)
  })
  it('t0', () => {
    expect(copy.t0Someone('Maya', L)).toBe("Maya's already there. → " + L)
    expect(copy.t0Nobody('🍜', THU_7PM, THU_2PM, L)).toBe('Starting now: 🍜 tonight 7pm. → ' + L)
  })
  it('fell through — the app takes the blame', () => {
    expect(copy.fellThrough()).toBe("Tonight thinned out — happens. I'll ask again soon.")
  })
  it('exit poll', () => {
    expect(copy.exitPoll(L)).toBe('Honest question: would last night have happened without this? → ' + L)
  })
  it('welcome', () => {
    expect(copy.welcome('Park Slope', L)).toBe("You're in Park Slope. Keep this link — it's yours: " + L)
  })
  it('later nudge', () => {
    expect(copy.laterNudge('🍜', THU_7PM, THU_2PM, L)).toBe('🍜 tonight 7pm is still open — in? → ' + L)
  })
})

import type { AttendanceState, Circle, Round } from './types'
import type { NewRound } from './repo'
import { isoWeek, matchesAskWindow, nextOccurrence, slotKey } from './time'

const CLOSES_BEFORE_MS = 2 * 3600_000
export const MAX_ROUNDS_PER_DAY = 1
export const MAX_ROUNDS_PER_WEEK = 3

export function planScheduledRounds(
  circle: Circle, now: Date, usedSlots: Set<string>, priorScheduledCount: number,
): NewRound[] {
  const week = isoWeek(now)
  const out: NewRound[] = []
  circle.cadence.forEach((t, idx) => {
    if (!matchesAskWindow(t, now)) return
    const slot = slotKey(week, idx)
    if (usedSlots.has(slot)) return
    const verb = t.verb === 'rotate'
      ? circle.verbSet[priorScheduledCount % circle.verbSet.length]
      : circle.verbSet.find((v) => v.emoji === t.verb) ?? circle.verbSet[0]
    const proposedAt = nextOccurrence(now, t.proposeDow, t.proposeHour)
    out.push({
      circleId: circle.id, verbEmoji: verb.emoji, verbLabel: verb.label,
      proposedAt, closesAt: new Date(proposedAt.getTime() - CLOSES_BEFORE_MS),
      detail: null, source: 'scheduled', state: 'open', cadenceSlot: slot,
    })
  })
  return out
}

/** Kindles release into send windows so they are indistinguishable from scheduled asks.
 *  Returns round ids to release (at most one per tick), respecting circle round caps. */
export function planKindleRelease(
  circle: Circle, now: Date, queued: Round[], releasedToday: number, releasedThisWeek: number,
): string[] {
  const live = queued.filter((r) => r.closesAt.getTime() > now.getTime())
  if (live.length === 0) return []
  if (releasedToday >= MAX_ROUNDS_PER_DAY || releasedThisWeek >= MAX_ROUNDS_PER_WEEK) return []
  if (!circle.cadence.some((t) => matchesAskWindow(t, now))) return []
  return [live[0].id]
}

/** true = fell through */
export function planHoldDecision(attendanceStates: AttendanceState[]): boolean {
  return attendanceStates.filter((s) => s === 'confirmed').length < 2
}

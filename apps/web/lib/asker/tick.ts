import * as repo from './repo'
import { sendSms, type SmsDeps } from './sms'
import { deliverSms } from './twilio'
import { copy } from './copy'
import { MAX_ROUNDS_PER_DAY, MAX_ROUNDS_PER_WEEK, planHoldDecision, planKindleRelease, planScheduledRounds } from './planner'
import { isoWeek, nyDayStartUtc, nyParts, nyWeekStartUtc } from './time'
import type { Attendance, EventRow, Member, Round, SmsKind } from './types'

const deps: SmsDeps = {
  claim: repo.smsClaim,
  markSent: repo.smsMarkSent,
  markFailed: repo.smsMarkFailed,
  nonEventCountSince: repo.smsNonEventCountSince,
  deliver: deliverSms,
}

function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}
const roundLink = (m: Member, r: { id: string }) => `${baseUrl()}/t/${m.token}/r/${r.id}`
const eventLink = (m: Member, e: { id: string }) => `${baseUrl()}/t/${m.token}/e/${e.id}`
const exitLink = (m: Member, e: { id: string }) => `${baseUrl()}/t/${m.token}/x/${e.id}`

async function send(m: Member, kind: SmsKind, contextId: string, body: string, now: Date): Promise<number> {
  return (await sendSms(deps, { member: m, kind, contextId, body, now })) === 'sent' ? 1 : 0
}

export function t0Recipients(attendance: Attendance[]): string[] {
  return attendance.filter((a) => a.state === 'in' || a.state === 'confirmed').map((a) => a.memberId)
}

async function sendAsk(round: Round, members: Member[], now: Date): Promise<number> {
  let sent = 0
  for (const m of members) {
    sent += await send(m, 'ask', round.id, copy.ask(round.verbEmoji, round.proposedAt, now, roundLink(m, round)), now)
  }
  return sent
}

export async function sendStrikeBroadcast(eventId: string, now: Date): Promise<number> {
  const event = await repo.getEvent(eventId)
  if (!event) return 0
  const round = await repo.getRound(event.roundId)
  if (!round) return 0
  const members = await repo.listMembers(event.circleId)
  const attendance = await repo.attendanceForEvent(eventId)
  const inIds = new Set(attendance.filter((a) => a.state === 'in').map((a) => a.memberId))
  const nameOf = new Map(members.map((m) => [m.id, m.name]))
  let sent = 0
  for (const m of members) {
    const others = [...inIds].filter((id) => id !== m.id).map((id) => nameOf.get(id)!)
    const body = inIds.has(m.id)
      ? copy.strikeIn(round.verbEmoji, event.happensAt, now, others, eventLink(m, event))
      : copy.strikeJoin(round.verbEmoji, event.happensAt, now, others, eventLink(m, event))
    sent += await send(m, 'strike', eventId, body, now)
  }
  return sent
}

export type TickSummary = {
  roundsOpened: number; kindlesReleased: number; roundsExpired: number
  holdsOpened: number; holdsDecided: number; t0Sent: number
  latersNudged: number; markedDone: number; exitPollsSent: number; smsSent: number
}

export async function runTick(now: Date): Promise<TickSummary> {
  const s: TickSummary = {
    roundsOpened: 0, kindlesReleased: 0, roundsExpired: 0, holdsOpened: 0,
    holdsDecided: 0, t0Sent: 0, latersNudged: 0, markedDone: 0, exitPollsSent: 0, smsSent: 0,
  }
  const circles = await repo.allCircles()
  const dayStart = nyDayStartUtc(now)
  const weekStart = nyWeekStartUtc(now)

  for (const circle of circles) {
    try {
      const members = await repo.listMembers(circle.id)
      const releasedToday = await repo.countRoundsReleasedSince(circle.id, dayStart)
      const releasedThisWeek = await repo.countRoundsReleasedSince(circle.id, weekStart)

      // 1. Release queued kindles first — human desire beats the template.
      const queued = await repo.queuedKindles(circle.id)
      for (const id of planKindleRelease(circle, now, queued, releasedToday, releasedThisWeek)) {
        await repo.releaseRound(id)
        const round = await repo.getRound(id)
        if (round) s.smsSent += await sendAsk(round, members, now)
        s.kindlesReleased++
      }

      // 2. Open scheduled rounds (skip if the day/week budget is now spent).
      const releasedTodayAfter = await repo.countRoundsReleasedSince(circle.id, dayStart)
      const releasedWeekAfter = await repo.countRoundsReleasedSince(circle.id, weekStart)
      if (releasedTodayAfter < MAX_ROUNDS_PER_DAY && releasedWeekAfter < MAX_ROUNDS_PER_WEEK) {
        const used = await repo.usedCadenceSlots(circle.id, isoWeek(now))
        const prior = await repo.countScheduledRounds(circle.id)
        for (const nr of planScheduledRounds(circle, now, used, prior)) {
          const round = await repo.insertRound(nr) // slot conflict -> null -> already done
          if (round) {
            s.roundsOpened++
            s.smsSent += await sendAsk(round, members, now)
          }
        }
      }
    } catch (err) {
      console.error(`tick: circle ${circle.id} failed`, err)
    }
  }

  // 3. Expire rounds past close. Silent — no SMS, ever.
  s.roundsExpired = await repo.expireOpenRoundsPast(now)

  // 4. Open holds at T-5h for early strikes.
  for (const e of await repo.eventsNeedingHoldOpen(now)) {
    const members = await repo.listMembers(e.circleId)
    const round = await repo.getRound(e.roundId)
    if (!round) continue
    const attendance = await repo.attendanceForEvent(e.id)
    const inIds = new Set(attendance.filter((a) => a.state === 'in').map((a) => a.memberId))
    for (const m of members.filter((m) => inIds.has(m.id))) {
      s.smsSent += await send(m, 'hold', e.id, copy.hold(round.verbEmoji, e.happensAt, now, eventLink(m, e)), now)
    }
    await repo.markHoldOpened(e.id, now)
    s.holdsOpened++
  }

  // 5. Decide holds at T-2h. The app takes the blame, to confirmed members only.
  for (const e of await repo.eventsNeedingHoldDecision(now)) {
    const attendance = await repo.attendanceForEvent(e.id)
    // past start time the walk-in states own the truth — never fell-through retroactively
    const fellThrough = now >= e.happensAt ? false : planHoldDecision(attendance.map((a) => a.state))
    await repo.decideHold(e.id, fellThrough, now)
    s.holdsDecided++
    if (fellThrough) {
      const members = await repo.listMembers(e.circleId)
      const confirmed = new Set(attendance.filter((a) => a.state === 'confirmed').map((a) => a.memberId))
      for (const m of members.filter((m) => confirmed.has(m.id))) {
        s.smsSent += await send(m, 'fell_through', e.id, copy.fellThrough(), now)
      }
    }
  }

  // 6. T-0 status nudges — latch per event so cron jitter can never skip them.
  for (const e of await repo.eventsNeedingT0(now)) {
    if (e.holdOpenedAt && !e.holdDecidedAt) continue
    const members = await repo.listMembers(e.circleId)
    const round = await repo.getRound(e.roundId)
    if (!round) continue
    const attendance = await repo.attendanceForEvent(e.id)
    const hereIds = attendance.filter((a) => a.state === 'here').map((a) => a.memberId)
    const nameOf = new Map(members.map((m) => [m.id, m.name]))
    const firstHere = hereIds.length ? nameOf.get(hereIds[0])! : null
    for (const id of t0Recipients(attendance)) {
      const m = members.find((mm) => mm.id === id)!
      const body = firstHere
        ? copy.t0Someone(firstHere, eventLink(m, e))
        : copy.t0Nobody(round.verbEmoji, e.happensAt, now, eventLink(m, e))
      s.t0Sent += await send(m, 't0', e.id, body, now)
    }
    await repo.markT0Sent(e.id, now)
  }

  // 7. Later re-asks at T-8h on still-open rounds.
  for (const r of await repo.openRoundsNearPropose(now)) {
    const laterIds = await repo.latersForRound(r.id)
    if (!laterIds.length) continue
    const members = await repo.listMembers(r.circleId)
    for (const id of laterIds) {
      const m = members.find((mm) => mm.id === id)
      if (m) s.latersNudged += await send(m, 'later_nudge', r.id, copy.laterNudge(r.verbEmoji, r.proposedAt, now, roundLink(m, r)), now)
    }
  }

  // 8. Mark events done at T+3h.
  for (const e of await repo.eventsToMarkDone(now)) {
    await repo.markDone(e.id)
    s.markedDone++
  }

  // 9. Exit polls — next morning, 9-11am NY, to people who were there.
  const hour = nyParts(now).hour
  if (hour >= 9 && hour < 11) {
    for (const e of await repo.eventsForExitPoll(now)) {
      const members = await repo.listMembers(e.circleId)
      const attendance = await repo.attendanceForEvent(e.id)
      const hereIds = new Set(attendance.filter((a) => a.state === 'here').map((a) => a.memberId))
      for (const m of members.filter((m) => hereIds.has(m.id))) {
        s.exitPollsSent += await send(m, 'exit_poll', e.id, copy.exitPoll(exitLink(m, e)), now)
      }
      await repo.markExitPollsSent(e.id, now)
    }
  }

  s.smsSent += s.t0Sent + s.latersNudged + s.exitPollsSent
  return s
}

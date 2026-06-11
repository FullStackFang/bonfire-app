import { sql } from './db'
import type {
  Attendance, AttendanceState, CadenceTemplate, Circle, EventRow, Member, Round, SmsKind, Verb,
} from './types'
import { NON_EVENT_KINDS } from './types'

// ---- mapping helpers (postgres.camel gives camelCase keys) ----
const toCircle = (r: any): Circle => ({
  id: r.id, name: r.name, verbSet: r.verbSet as Verb[],
  kThreshold: r.kThreshold, cadence: r.cadence as CadenceTemplate[],
})
const toMember = (r: any): Member => ({
  id: r.id, circleId: r.circleId, name: r.name, phone: r.phone, token: r.token,
})
const toRound = (r: any): Round => ({
  id: r.id, circleId: r.circleId, verbEmoji: r.verbEmoji, verbLabel: r.verbLabel,
  proposedAt: r.proposedAt, closesAt: r.closesAt, detail: r.detail,
  source: r.source, state: r.state, cadenceSlot: r.cadenceSlot,
})
const toEvent = (r: any): EventRow => ({
  id: r.id, roundId: r.roundId, circleId: r.circleId, happensAt: r.happensAt,
  venueId: r.venueId, state: r.state, needsHold: r.needsHold,
  holdOpenedAt: r.holdOpenedAt, holdDecidedAt: r.holdDecidedAt, t0SentAt: r.t0SentAt,
  exitPollsSentAt: r.exitPollsSentAt,
})
const toAttendance = (r: any): Attendance => ({
  eventId: r.eventId, memberId: r.memberId, state: r.state, etaMinutes: r.etaMinutes,
})

// ---- circles / members ----
export async function createCircle(name: string, kThreshold: number): Promise<Circle> {
  const [row] = await sql()`insert into asker.circles (name, k_threshold) values (${name}, ${kThreshold}) returning *`
  return toCircle(row)
}
export async function getCircle(id: string): Promise<Circle | null> {
  const [row] = await sql()`select * from asker.circles where id = ${id}`
  return row ? toCircle(row) : null
}
export async function insertMember(circleId: string, name: string, phone: string, token: string): Promise<Member> {
  const [row] = await sql()`
    insert into asker.members (circle_id, name, phone, token) values (${circleId}, ${name}, ${phone}, ${token})
    returning *`
  return toMember(row)
}
export async function getMemberByToken(token: string): Promise<{ member: Member; circle: Circle } | null> {
  const [row] = await sql()`
    select m.*, row_to_json(c.*) as circle from asker.members m
    join asker.circles c on c.id = m.circle_id where m.token = ${token}`
  if (!row) return null
  const c = row.circle as any
  return {
    member: toMember(row),
    circle: toCircle({ ...c, verbSet: c.verb_set, kThreshold: c.k_threshold, cadence: c.cadence }),
  }
}
export async function listMembers(circleId: string): Promise<Member[]> {
  const rows = await sql()`select * from asker.members where circle_id = ${circleId} order by joined_at`
  return rows.map(toMember)
}

// ---- rounds ----
export type NewRound = {
  circleId: string; verbEmoji: string; verbLabel: string; proposedAt: Date; closesAt: Date
  detail: string | null; source: 'scheduled' | 'kindled'; state: 'queued' | 'open'; cadenceSlot: string | null
}
export async function insertRound(r: NewRound): Promise<Round | null> {
  // on conflict (cadence_slot) do nothing -> idempotent scheduled creation
  const [row] = await sql()`
    insert into asker.rounds (circle_id, verb_emoji, verb_label, proposed_at, closes_at, detail, source, state, cadence_slot)
    values (${r.circleId}, ${r.verbEmoji}, ${r.verbLabel}, ${r.proposedAt}, ${r.closesAt}, ${r.detail}, ${r.source}, ${r.state}, ${r.cadenceSlot})
    on conflict (circle_id, cadence_slot) do nothing
    returning *`
  return row ? toRound(row) : null
}
export async function getRound(id: string): Promise<Round | null> {
  const [row] = await sql()`select * from asker.rounds where id = ${id}`
  return row ? toRound(row) : null
}
export async function openRoundsForCircle(circleId: string): Promise<Round[]> {
  const rows = await sql()`
    select * from asker.rounds where circle_id = ${circleId} and state = 'open' order by proposed_at`
  return rows.map(toRound)
}
export async function usedCadenceSlots(circleId: string, week: string): Promise<Set<string>> {
  const rows = await sql()`
    select cadence_slot from asker.rounds
    where circle_id = ${circleId} and cadence_slot like ${week + '%'}`
  return new Set(rows.map((r: any) => r.cadenceSlot as string))
}
export async function countScheduledRounds(circleId: string): Promise<number> {
  const [row] = await sql()`
    select count(*)::int as n from asker.rounds where circle_id = ${circleId} and source = 'scheduled'`
  return row.n
}
export async function countRoundsReleasedSince(circleId: string, since: Date): Promise<number> {
  const [row] = await sql()`
    select count(*)::int as n from asker.rounds
    where circle_id = ${circleId} and state in ('open','struck','expired') and created_at >= ${since}`
  return row.n
}
export async function queuedKindles(circleId: string): Promise<Round[]> {
  const rows = await sql()`
    select * from asker.rounds where circle_id = ${circleId} and state = 'queued' order by created_at`
  return rows.map(toRound)
}
export async function releaseRound(id: string): Promise<void> {
  await sql()`update asker.rounds set state = 'open', created_at = now() where id = ${id} and state = 'queued'`
}
export async function expireOpenRoundsPast(now: Date): Promise<number> {
  const rows = await sql()`
    update asker.rounds set state = 'expired'
    where state = 'open' and closes_at <= ${now} returning id`
  return rows.length
}
export async function allCircles(): Promise<Circle[]> {
  const rows = await sql()`select * from asker.circles`
  return rows.map(toCircle)
}

// ---- replies + strike (THE transaction) ----
export type ReplyResult =
  | { kind: 'closed' }
  | { kind: 'recorded' }
  | { kind: 'struck'; eventId: string }

export async function replyAndMaybeStrike(
  roundId: string, memberId: string, answer: 'in' | 'out' | 'later', now: Date,
): Promise<ReplyResult> {
  return sql().begin(async (tx) => {
    // FOR UPDATE serializes concurrent Kth replies -> the strike happens exactly once.
    const [round] = await tx`select * from asker.rounds where id = ${roundId} for update`
    if (!round || round.state !== 'open' || new Date(round.closesAt).getTime() <= now.getTime()) {
      return { kind: 'closed' as const }
    }
    await tx`
      insert into asker.replies (round_id, member_id, answer) values (${roundId}, ${memberId}, ${answer})
      on conflict (round_id, member_id) do update set answer = ${answer}, created_at = now()`
    if (answer !== 'in') return { kind: 'recorded' as const }
    const [{ n }] = await tx`
      select count(*)::int as n from asker.replies where round_id = ${roundId} and answer = 'in'`
    const [{ kThreshold }] = await tx`
      select k_threshold as "kThreshold" from asker.circles where id = ${round.circleId}`
    if (n < kThreshold) return { kind: 'recorded' as const }
    await tx`update asker.rounds set state = 'struck' where id = ${roundId}`
    const needsHold = new Date(round.proposedAt).getTime() - now.getTime() > 24 * 3600_000
    const [event] = await tx`
      insert into asker.events (round_id, circle_id, happens_at, needs_hold)
      values (${roundId}, ${round.circleId}, ${round.proposedAt}, ${needsHold}) returning id`
    await tx`
      insert into asker.attendance (event_id, member_id, state)
      select ${event.id}, member_id, 'in' from asker.replies where round_id = ${roundId} and answer = 'in'`
    return { kind: 'struck' as const, eventId: event.id as string }
  }) as Promise<ReplyResult>
}
export async function getMyReply(roundId: string, memberId: string): Promise<'in' | 'out' | 'later' | null> {
  const [row] = await sql()`
    select answer from asker.replies where round_id = ${roundId} and member_id = ${memberId}`
  return row ? row.answer : null
}
export async function latersForRound(roundId: string): Promise<string[]> {
  const rows = await sql()`
    select member_id from asker.replies where round_id = ${roundId} and answer = 'later'`
  return rows.map((r: any) => r.memberId as string)
}

// ---- events / attendance ----
export async function getEvent(id: string): Promise<EventRow | null> {
  const [row] = await sql()`select * from asker.events where id = ${id}`
  return row ? toEvent(row) : null
}
export async function eventsForCircle(circleId: string, states: string[]): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where circle_id = ${circleId} and state = any(${states}) order by happens_at`
  return rows.map(toEvent)
}
export async function attendanceForEvent(eventId: string): Promise<Attendance[]> {
  const rows = await sql()`select * from asker.attendance where event_id = ${eventId}`
  return rows.map(toAttendance)
}
export async function setAttendance(
  eventId: string, memberId: string, state: AttendanceState, etaMinutes: number | null,
): Promise<void> {
  await sql()`
    insert into asker.attendance (event_id, member_id, state, eta_minutes)
    values (${eventId}, ${memberId}, ${state}, ${etaMinutes})
    on conflict (event_id, member_id) do update set state = ${state}, eta_minutes = ${etaMinutes}, updated_at = now()`
}
export async function eventsNeedingHoldOpen(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'on' and needs_hold and hold_opened_at is null
    and happens_at - interval '5 hours' <= ${now}`
  return rows.map(toEvent)
}
export async function markHoldOpened(eventId: string, now: Date): Promise<void> {
  await sql()`update asker.events set hold_opened_at = ${now} where id = ${eventId}`
}
export async function eventsNeedingHoldDecision(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'on' and hold_opened_at is not null and hold_decided_at is null
    and happens_at - interval '2 hours' <= ${now}`
  return rows.map(toEvent)
}
export async function decideHold(eventId: string, fellThrough: boolean, now: Date): Promise<void> {
  await sql()`
    update asker.events set hold_decided_at = ${now}, state = ${fellThrough ? 'fell_through' : 'on'}
    where id = ${eventId}`
}
export async function eventsNeedingT0(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'on' and t0_sent_at is null and happens_at <= ${now}`
  return rows.map(toEvent)
}
export async function markT0Sent(eventId: string, now: Date): Promise<void> {
  await sql()`update asker.events set t0_sent_at = ${now} where id = ${eventId}`
}
export async function eventsToMarkDone(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'on' and happens_at + interval '3 hours' <= ${now}`
  return rows.map(toEvent)
}
export async function markDone(eventId: string): Promise<void> {
  await sql()`update asker.events set state = 'done' where id = ${eventId}`
}
export async function eventsForExitPoll(now: Date): Promise<EventRow[]> {
  const rows = await sql()`
    select * from asker.events where state = 'done' and exit_polls_sent_at is null
    and happens_at + interval '12 hours' <= ${now}`
  return rows.map(toEvent)
}
export async function markExitPollsSent(eventId: string, now: Date): Promise<void> {
  await sql()`update asker.events set exit_polls_sent_at = ${now} where id = ${eventId}`
}
export async function insertExitPoll(eventId: string, memberId: string, wouldHaveHappened: boolean): Promise<void> {
  await sql()`
    insert into asker.exit_polls (event_id, member_id, would_have_happened)
    values (${eventId}, ${memberId}, ${wouldHaveHappened})
    on conflict (event_id, member_id) do update set would_have_happened = ${wouldHaveHappened}`
}

// ---- rounds due for later-nudges ----
export async function openRoundsNearPropose(now: Date): Promise<Round[]> {
  const rows = await sql()`
    select * from asker.rounds where state = 'open' and proposed_at - interval '8 hours' <= ${now}`
  return rows.map(toRound)
}

// ---- venues / places ----
export async function setEventVenue(eventId: string, circleId: string, name: string): Promise<void> {
  const [venue] = await sql()`
    insert into asker.venues (circle_id, name) values (${circleId}, ${name})
    on conflict (circle_id, name) do update set name = excluded.name returning id`
  await sql()`update asker.events set venue_id = ${venue.id} where id = ${eventId}`
}
export async function placesForCircle(circleId: string): Promise<{ name: string; visits: number }[]> {
  const rows = await sql()`
    select v.name, count(e.id)::int as visits from asker.venues v
    join asker.events e on e.venue_id = v.id and e.state in ('on','done')
    where v.circle_id = ${circleId} group by v.name order by visits desc, v.name`
  return rows.map((r: any) => ({ name: r.name as string, visits: r.visits as number }))
}
export async function logPageView(memberId: string, page: string): Promise<void> {
  await sql()`insert into asker.page_views (member_id, page) values (${memberId}, ${page})`
}

// ---- sms log (SmsDeps implementation) ----
export async function smsClaim(memberId: string, kind: SmsKind, contextId: string, body: string): Promise<boolean> {
  const rows = await sql()`
    insert into asker.sms_log (member_id, kind, context_id, body, status)
    values (${memberId}, ${kind}, ${contextId}, ${body}, 'claimed')
    on conflict (member_id, kind, context_id) do update
      set status = 'claimed', body = excluded.body, sent_at = now()
      where asker.sms_log.status = 'failed'
         or (asker.sms_log.status = 'claimed' and asker.sms_log.sent_at < now() - interval '10 minutes')
    returning id`
  return rows.length > 0
}
export async function smsMarkSent(memberId: string, kind: SmsKind, contextId: string): Promise<void> {
  await sql()`update asker.sms_log set status = 'sent'
    where member_id = ${memberId} and kind = ${kind} and context_id = ${contextId}`
}
export async function smsMarkFailed(memberId: string, kind: SmsKind, contextId: string): Promise<void> {
  await sql()`update asker.sms_log set status = 'failed'
    where member_id = ${memberId} and kind = ${kind} and context_id = ${contextId}`
}
export async function smsNonEventCountSince(memberId: string, since: Date): Promise<number> {
  const [row] = await sql()`
    select count(*)::int as n from asker.sms_log
    where member_id = ${memberId} and sent_at >= ${since} and status <> 'failed'
      and kind = any(${[...NON_EVENT_KINDS]})`
  return row.n
}

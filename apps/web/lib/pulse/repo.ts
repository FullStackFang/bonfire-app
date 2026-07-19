/* eslint-disable @typescript-eslint/no-explicit-any -- row mappers take dynamically-shaped
   postgres rows (camelCased); typing each as `any` is the established asker/repo boundary idiom. */
import { cache } from 'react'
import { sql } from '../db'
import type {
  AvailabilityBaseline, AvailabilityException, Crew, Participant, PhoneVerification,
  Presence, PresenceRow, Pulse, PulseResponse, PulseResponseRow, BoardStatus, PulseStatus,
  PlaceGeoStatus,
} from './types'

// ---- mapping helpers (postgres.camel gives camelCase keys; bigint comes back as string) ----
const toParticipant = (r: any): Participant => ({
  id: r.id, token: r.token, displayName: r.displayName ?? null,
  phone: r.phone ?? null, phoneVerifiedAt: r.phoneVerifiedAt ?? null, createdAt: r.createdAt,
})
const toVerification = (r: any): PhoneVerification => ({
  id: r.id, phone: r.phone, codeHash: r.codeHash, expiresAt: r.expiresAt,
  attempts: r.attempts, consumedAt: r.consumedAt ?? null, createdAt: r.createdAt,
})
const toCrew = (r: any): Crew => ({
  id: r.id, token: r.token, name: r.name, version: String(r.version),
  createdBy: r.createdBy, createdAt: r.createdAt, archivedAt: r.archivedAt ?? null,
})
const toPulse = (r: any): Pulse => ({
  id: r.id, token: r.token, crewId: r.crewId ?? null,
  title: r.title, place: r.place, timeLabel: r.timeLabel,
  expiresAt: r.expiresAt, closedAt: r.closedAt ?? null, version: String(r.version),
  createdBy: r.createdBy, clientUuid: r.clientUuid, createdAt: r.createdAt,
  placeLat: r.placeLat ?? null, placeLng: r.placeLng ?? null,
  placeGeoStatus: r.placeGeoStatus ?? 'unresolved',
})
const toPresenceRow = (r: any): PresenceRow => ({
  crewId: r.crewId, participantId: r.participantId, status: r.status,
  note: r.note ?? null, updatedAt: r.updatedAt, displayName: r.displayName ?? null,
})
const toResponseRow = (r: any): PulseResponseRow => ({
  pulseId: r.pulseId, participantId: r.participantId, status: r.status,
  etaMinutes: r.etaMinutes ?? null, note: r.note ?? null, updatedAt: r.updatedAt,
  displayName: r.displayName ?? null,
})

// ---- participants ----
export async function getParticipantByToken(token: string): Promise<Participant | null> {
  const [row] = await sql()`select * from pulse.participants where token = ${token}`
  return row ? toParticipant(row) : null
}
export async function createParticipant(token: string): Promise<Participant> {
  const [row] = await sql()`insert into pulse.participants (token) values (${token}) returning *`
  return toParticipant(row)
}
export async function setDisplayName(participantId: string, name: string): Promise<Participant> {
  const [row] = await sql()`
    update pulse.participants set display_name = ${name} where id = ${participantId} returning *`
  return toParticipant(row)
}
export async function getParticipantByPhone(phone: string): Promise<Participant | null> {
  const [row] = await sql()`select * from pulse.participants where phone = ${phone}`
  return row ? toParticipant(row) : null
}
export async function setPhoneVerified(participantId: string, phone: string): Promise<Participant> {
  const [row] = await sql()`
    update pulse.participants set phone = ${phone}, phone_verified_at = now()
    where id = ${participantId} returning *`
  return toParticipant(row)
}
/** Ghost merge: carry a device's anonymous pulse footprint onto the canonical participant it just
 *  verified into. Reassigns pulses it created and pulse responses it holds. `pulse_responses` is
 *  PK (pulse_id, participant_id), so where the canonical already responded to the same pulse the
 *  ghost's row is dropped first — the canonical's response (the durable identity being consolidated
 *  onto) is the one kept; a differing status/note/ETA on the ghost's is lost, which is rare and
 *  low-stakes (presence, not durable data). Statements run sequentially: the local PGlite harness
 *  serializes one backend session (see scripts/local-db.mjs) and racing statements interleave the
 *  wire protocol. Each is idempotent by predicate, so a partial failure is safe to re-run. */
export async function reassignPulseFootprint(fromGhostId: string, toCanonicalId: string): Promise<void> {
  await sql()`
    delete from pulse.pulse_responses g
    where g.participant_id = ${fromGhostId}
      and exists (select 1 from pulse.pulse_responses c
                  where c.pulse_id = g.pulse_id and c.participant_id = ${toCanonicalId})`
  await sql()`
    update pulse.pulse_responses set participant_id = ${toCanonicalId}
    where participant_id = ${fromGhostId}`
  await sql()`
    update pulse.pulses set created_by = ${toCanonicalId}
    where created_by = ${fromGhostId}`
}

// ---- phone verifications (OTP) ----
export async function createVerification(phone: string, codeHash: string, expiresAt: Date): Promise<PhoneVerification> {
  const [row] = await sql()`
    insert into pulse.phone_verifications (phone, code_hash, expires_at)
    values (${phone}, ${codeHash}, ${expiresAt}) returning *`
  return toVerification(row)
}
/** Latest unconsumed verification for a phone (may be expired/exhausted — caller decides). */
export async function latestVerification(phone: string): Promise<PhoneVerification | null> {
  const [row] = await sql()`
    select * from pulse.phone_verifications
    where phone = ${phone} and consumed_at is null
    order by created_at desc limit 1`
  return row ? toVerification(row) : null
}
export async function bumpVerificationAttempts(id: string): Promise<number> {
  const [row] = await sql()`
    update pulse.phone_verifications set attempts = attempts + 1 where id = ${id}
    returning attempts`
  return Number(row.attempts)
}
export async function consumeVerification(id: string): Promise<void> {
  await sql()`update pulse.phone_verifications set consumed_at = now() where id = ${id}`
}

// ---- crews ----
export async function createCrew(token: string, name: string, createdBy: string): Promise<Crew> {
  const [row] = await sql()`
    insert into pulse.crews (token, name, created_by) values (${token}, ${name}, ${createdBy})
    returning *`
  return toCrew(row)
}
// cache(): generateMetadata and the page body both resolve the same token — one query per request.
export const getCrewByToken = cache(async (token: string): Promise<Crew | null> => {
  const [row] = await sql()`select * from pulse.crews where token = ${token}`
  return row ? toCrew(row) : null
})
export async function getCrewById(id: string): Promise<Crew | null> {
  const [row] = await sql()`select * from pulse.crews where id = ${id}`
  return row ? toCrew(row) : null
}
async function bumpCrewVersion(id: string): Promise<void> {
  await sql()`update pulse.crews set version = version + 1 where id = ${id}`
}

// ---- crew membership (the roster: scope for SMS delivery and Who's-Around) ----
export type CrewMemberRow = { participantId: string; displayName: string | null; joinedAt: Date }

/** Idempotent join. Bumps the crew version only when a row was actually added. */
export async function addCrewMember(crewId: string, participantId: string): Promise<void> {
  const rows = await sql()`
    insert into pulse.crew_members (crew_id, participant_id)
    values (${crewId}, ${participantId})
    on conflict (crew_id, participant_id) do nothing
    returning crew_id`
  if (rows.length > 0) await bumpCrewVersion(crewId)
}
/** Quiet leave. No notification of any kind — the row disappears, the version bumps. */
export async function removeCrewMember(crewId: string, participantId: string): Promise<void> {
  const rows = await sql()`
    delete from pulse.crew_members
    where crew_id = ${crewId} and participant_id = ${participantId}
    returning crew_id`
  if (rows.length > 0) await bumpCrewVersion(crewId)
}
export async function isCrewMember(crewId: string, participantId: string): Promise<boolean> {
  const rows = await sql()`
    select 1 from pulse.crew_members
    where crew_id = ${crewId} and participant_id = ${participantId}`
  return rows.length > 0
}
export async function membersForCrew(crewId: string): Promise<CrewMemberRow[]> {
  const rows = await sql()`
    select cm.participant_id, cm.joined_at, pa.display_name
    from pulse.crew_members cm
    join pulse.participants pa on pa.id = cm.participant_id
    where cm.crew_id = ${crewId}
    order by cm.joined_at`
  return rows.map((r: any) => ({
    participantId: r.participantId, displayName: r.displayName ?? null, joinedAt: r.joinedAt,
  }))
}
/** Member rows WITH phones — SMS fan-out only. The result must never be serialized. */
export async function memberPhonesForCrew(crewId: string): Promise<{ participantId: string; phone: string | null }[]> {
  const rows = await sql()`
    select cm.participant_id, pa.phone
    from pulse.crew_members cm
    join pulse.participants pa on pa.id = cm.participant_id
    where cm.crew_id = ${crewId}
    order by cm.joined_at`
  return rows.map((r: any) => ({ participantId: r.participantId, phone: r.phone ?? null }))
}

// ---- pulses ----
export type NewPulse = {
  token: string
  crewId: string | null
  title: string
  place: string
  timeLabel: string
  expiresAt: Date
  createdBy: string
  clientUuid: string
  // Best-effort geocode of `place`, resolved before insert. Defaults keep creation working when
  // the caller skips geocoding (status defaults to 'unresolved', coordinates null).
  placeLat?: number | null
  placeLng?: number | null
  placeGeoStatus?: PlaceGeoStatus
}
/** Idempotent on (crew_id, created_by, client_uuid) — a double-tap/retry yields one pulse. */
export async function createPulse(p: NewPulse): Promise<Pulse> {
  const [row] = await sql()`
    insert into pulse.pulses (
      token, crew_id, title, place, time_label, expires_at, created_by, client_uuid,
      place_lat, place_lng, place_geo_status)
    values (
      ${p.token}, ${p.crewId}, ${p.title}, ${p.place}, ${p.timeLabel}, ${p.expiresAt}, ${p.createdBy}, ${p.clientUuid},
      ${p.placeLat ?? null}, ${p.placeLng ?? null}, ${p.placeGeoStatus ?? 'unresolved'})
    on conflict (crew_id, created_by, client_uuid) do nothing
    returning *`
  if (row) {
    if (p.crewId) await bumpCrewVersion(p.crewId)
    return toPulse(row)
  }
  // Conflict: the pulse already exists — return it (idempotent), no version bump.
  const [existing] = await sql()`
    select * from pulse.pulses
    where created_by = ${p.createdBy} and client_uuid = ${p.clientUuid}
      and crew_id is not distinct from ${p.crewId}`
  return toPulse(existing)
}
/** Apply an async geocode result. Bumps `version` so polling viewers pick up the map. */
export async function setPulseGeo(
  pulseId: string, lat: number | null, lng: number | null, status: PlaceGeoStatus,
): Promise<void> {
  await sql()`
    update pulse.pulses
    set place_lat = ${lat}, place_lng = ${lng}, place_geo_status = ${status},
        version = version + 1
    where id = ${pulseId}`
}
// cache(): generateMetadata and the page body both resolve the same token — one query per request.
export const getPulseByToken = cache(async (token: string): Promise<Pulse | null> => {
  const [row] = await sql()`select * from pulse.pulses where token = ${token}`
  return row ? toPulse(row) : null
})
export async function getPulseById(id: string): Promise<Pulse | null> {
  const [row] = await sql()`select * from pulse.pulses where id = ${id}`
  return row ? toPulse(row) : null
}
/** Live pulses in a crew (uses the partial index). Expired/wrapped rows are excluded. */
export async function activePulsesForCrew(crewId: string, now: Date): Promise<Pulse[]> {
  const rows = await sql()`
    select * from pulse.pulses
    where crew_id = ${crewId} and closed_at is null and expires_at > ${now}
    order by expires_at`
  return rows.map(toPulse)
}
/** Wrap a pulse: close it and bump versions. Idempotent — returns the (already) closed row. */
export async function closePulse(pulse: Pulse): Promise<Pulse> {
  const [row] = await sql()`
    update pulse.pulses set closed_at = coalesce(closed_at, now()), version = version + 1
    where id = ${pulse.id} returning *`
  if (pulse.crewId) await bumpCrewVersion(pulse.crewId)
  return toPulse(row)
}

// ---- board presence ----
export async function upsertPresence(
  crewId: string, participantId: string, status: BoardStatus, note: string | null,
): Promise<Presence> {
  const [row] = await sql()`
    insert into pulse.presence (crew_id, participant_id, status, note)
    values (${crewId}, ${participantId}, ${status}, ${note})
    on conflict (crew_id, participant_id)
    do update set status = excluded.status, note = excluded.note, updated_at = now()
    returning *`
  await bumpCrewVersion(crewId)
  return {
    crewId: row.crewId, participantId: row.participantId,
    status: row.status, note: row.note ?? null, updatedAt: row.updatedAt,
  }
}
export async function presenceForCrew(crewId: string): Promise<PresenceRow[]> {
  const rows = await sql()`
    select pr.*, pa.display_name from pulse.presence pr
    join pulse.participants pa on pa.id = pr.participant_id
    where pr.crew_id = ${crewId}
    order by pr.updated_at desc`
  return rows.map(toPresenceRow)
}

// ---- pulse responses ----
export async function upsertResponse(
  pulse: Pulse, participantId: string, status: PulseStatus,
  etaMinutes: number | null, note: string | null,
): Promise<PulseResponse> {
  const [row] = await sql()`
    insert into pulse.pulse_responses (pulse_id, participant_id, status, eta_minutes, note)
    values (${pulse.id}, ${participantId}, ${status}, ${etaMinutes}, ${note})
    on conflict (pulse_id, participant_id)
    do update set status = excluded.status, eta_minutes = excluded.eta_minutes,
                  note = excluded.note, updated_at = now()
    returning *`
  await sql()`update pulse.pulses set version = version + 1 where id = ${pulse.id}`
  if (pulse.crewId) await bumpCrewVersion(pulse.crewId)
  return {
    pulseId: row.pulseId, participantId: row.participantId, status: row.status,
    etaMinutes: row.etaMinutes ?? null, note: row.note ?? null, updatedAt: row.updatedAt,
  }
}
export async function responsesForPulse(pulseId: string): Promise<PulseResponseRow[]> {
  const rows = await sql()`
    select pr.*, pa.display_name from pulse.pulse_responses pr
    join pulse.participants pa on pa.id = pr.participant_id
    where pr.pulse_id = ${pulseId}
    order by pr.updated_at desc`
  return rows.map(toResponseRow)
}

// ---- dashboard reads (participant-scoped: only MY memberships/responses, never a roster) ----

/** A crew I'm part of (member ∪ presence), with MY board status when one exists. */
export type DashCrewRow = {
  id: string
  token: string
  name: string
  myStatus: BoardStatus | null
  myNote: string | null
}
/** Crews reachable via crew_members ∪ presence, unarchived, ordered by my latest activity
 *  (presence update or join — whichever is newer). */
export async function crewsForParticipant(participantId: string): Promise<DashCrewRow[]> {
  const rows = await sql()`
    select c.id, c.token, c.name, pr.status as my_status, pr.note as my_note
    from pulse.crews c
    left join pulse.crew_members cm
      on cm.crew_id = c.id and cm.participant_id = ${participantId}
    left join pulse.presence pr
      on pr.crew_id = c.id and pr.participant_id = ${participantId}
    where c.archived_at is null
      and (cm.participant_id is not null or pr.participant_id is not null)
    order by greatest(coalesce(pr.updated_at, 'epoch'), coalesce(cm.joined_at, 'epoch')) desc`
  return rows.map((r: any) => ({
    id: r.id, token: r.token, name: r.name,
    myStatus: r.myStatus ?? null, myNote: r.myNote ?? null,
  }))
}

/** A pulse I created or responded to, with crew context and MY response only. */
export type DashPulseRow = {
  token: string
  title: string
  place: string
  timeLabel: string
  expiresAt: Date
  closedAt: Date | null
  crewName: string | null
  myStatus: PulseStatus | null
  createdByMe: boolean
}
/** Pulses where I'm the creator ∪ I have a response row, split by liveness (same predicate as
 *  activePulsesForCrew): live soonest-expiry first, earlier most-recently-ended first, capped.
 *  The split, ordering, and cap run in SQL so history growth never inflates the transfer. */
export async function pulsesForParticipant(
  participantId: string, now: Date, pastLimit: number,
): Promise<{ live: DashPulseRow[]; earlier: DashPulseRow[] }> {
  const toDashRow = (r: any): DashPulseRow => ({
    token: r.token, title: r.title, place: r.place, timeLabel: r.timeLabel,
    expiresAt: r.expiresAt, closedAt: r.closedAt ?? null,
    crewName: r.crewName ?? null, myStatus: r.myStatus ?? null,
    createdByMe: r.createdBy === participantId,
  })
  // Sequential on purpose: the local PGlite harness serializes one backend session (see
  // scripts/local-db.mjs) and racing statements would interleave the wire protocol.
  const liveRows = await sql()`
    select p.token, p.title, p.place, p.time_label, p.expires_at, p.closed_at, p.created_by,
           c.name as crew_name, r.status as my_status
    from pulse.pulses p
    left join pulse.crews c on c.id = p.crew_id
    left join pulse.pulse_responses r
      on r.pulse_id = p.id and r.participant_id = ${participantId}
    where (p.created_by = ${participantId} or r.participant_id is not null)
      and p.closed_at is null and p.expires_at > ${now}
    order by p.expires_at asc`
  const earlierRows = await sql()`
    select p.token, p.title, p.place, p.time_label, p.expires_at, p.closed_at, p.created_by,
           c.name as crew_name, r.status as my_status
    from pulse.pulses p
    left join pulse.crews c on c.id = p.crew_id
    left join pulse.pulse_responses r
      on r.pulse_id = p.id and r.participant_id = ${participantId}
    where (p.created_by = ${participantId} or r.participant_id is not null)
      and not (p.closed_at is null and p.expires_at > ${now})
    order by least(coalesce(p.closed_at, 'infinity'::timestamptz), p.expires_at) desc
    limit ${pastLimit}`
  return { live: liveRows.map(toDashRow), earlier: earlierRows.map(toDashRow) }
}

// ---- availability (baseline + exceptions; passive — NOTHING here notifies anyone) ----
const toBaseline = (r: any): AvailabilityBaseline => ({
  id: r.id, participantId: r.participantId, daysOfWeek: r.daysOfWeek,
  startTime: String(r.startTime), endTime: String(r.endTime), timezone: r.timezone,
  label: r.label ?? null, createdAt: r.createdAt,
})
const toException = (r: any): AvailabilityException => ({
  id: r.id, participantId: r.participantId, state: r.state,
  startsAt: r.startsAt, endsAt: r.endsAt, allDay: r.allDay,
  label: r.label ?? null, createdAt: r.createdAt,
})

export type NewBaseline = {
  daysOfWeek: number[]
  startTime: string // 'HH:MM'
  endTime: string
  timezone: string
  label: string | null
}
export async function createBaseline(participantId: string, b: NewBaseline): Promise<AvailabilityBaseline> {
  const [row] = await sql()`
    insert into pulse.availability_baseline (participant_id, days_of_week, start_time, end_time, timezone, label)
    values (${participantId}, ${b.daysOfWeek}, ${b.startTime}, ${b.endTime}, ${b.timezone}, ${b.label})
    returning *`
  return toBaseline(row)
}
export async function baselinesForParticipant(participantId: string): Promise<AvailabilityBaseline[]> {
  const rows = await sql()`
    select * from pulse.availability_baseline where participant_id = ${participantId}
    order by created_at`
  return rows.map(toBaseline)
}
export async function deleteBaseline(id: string, participantId: string): Promise<boolean> {
  const rows = await sql()`
    delete from pulse.availability_baseline
    where id = ${id} and participant_id = ${participantId} returning id`
  return rows.length > 0
}

export type NewException = {
  state: 'free' | 'busy'
  startsAt: Date
  endsAt: Date
  allDay: boolean
  label: string | null
}
export async function createException(participantId: string, e: NewException): Promise<AvailabilityException> {
  const [row] = await sql()`
    insert into pulse.availability_exception (participant_id, state, starts_at, ends_at, all_day, label)
    values (${participantId}, ${e.state}, ${e.startsAt}, ${e.endsAt}, ${e.allDay}, ${e.label})
    returning *`
  return toException(row)
}
/** Exceptions that are current or upcoming (still-relevant corrections). */
export async function exceptionsForParticipant(participantId: string, now: Date): Promise<AvailabilityException[]> {
  const rows = await sql()`
    select * from pulse.availability_exception
    where participant_id = ${participantId} and ends_at > ${now}
    order by starts_at`
  return rows.map(toException)
}

/** Batch reads for Who's-Around: one query per table for a whole roster. */
export async function baselinesForParticipants(ids: string[]): Promise<AvailabilityBaseline[]> {
  if (ids.length === 0) return []
  const rows = await sql()`
    select * from pulse.availability_baseline where participant_id = any(${ids})
    order by created_at`
  return rows.map(toBaseline)
}
export async function exceptionsForParticipants(ids: string[], now: Date): Promise<AvailabilityException[]> {
  if (ids.length === 0) return []
  const rows = await sql()`
    select * from pulse.availability_exception
    where participant_id = any(${ids}) and ends_at > ${now}
    order by starts_at`
  return rows.map(toException)
}

// ---- events (B-test funnel; append-only) ----
export type EventKind =
  | 'open' | 'name_set' | 'status_set' | 'pulse_create' | 'crew_create' | 'pulse_wrap'
  | 'phone_verified' | 'baseline_set' | 'exception_set' | 'sms_sent' | 'around_view' | 'dash_view'
export async function logEvent(
  kind: EventKind,
  ref: { crewId?: string | null; pulseId?: string | null; participantId?: string | null } = {},
): Promise<void> {
  await sql()`
    insert into pulse.events (kind, crew_id, pulse_id, participant_id)
    values (${kind}, ${ref.crewId ?? null}, ${ref.pulseId ?? null}, ${ref.participantId ?? null})`
}

// ---- rate-limit counters (in the spirit of asker.sms_log dedupe) ----
export type RateScope = 'participant' | 'crew' | 'ip' | 'phone'
export async function logAction(scope: RateScope, scopeKey: string, action: string): Promise<void> {
  await sql()`
    insert into pulse.action_log (scope, scope_key, action) values (${scope}, ${scopeKey}, ${action})`
}
export async function countActions(
  scope: RateScope, scopeKey: string, action: string, windowSec: number,
): Promise<number> {
  const [row] = await sql()`
    select count(*)::int as n from pulse.action_log
    where scope = ${scope} and scope_key = ${scopeKey} and action = ${action}
      and at > now() - make_interval(secs => ${windowSec})`
  return Number(row.n)
}

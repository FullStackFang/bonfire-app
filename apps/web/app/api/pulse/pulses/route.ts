import { after } from 'next/server'
import { resolveOrCreateParticipant, isVerified } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { newToken } from '@/lib/ids'
import { CAPS, pulseMessage } from '@/lib/pulse/copy'
import { deriveWhenLabel } from '@/lib/pulse/time'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'
import { inQuietHours, quietHoursTimezone } from '@/lib/pulse/sms'
import { geocode } from '@/lib/pulse/geo'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Absolute origin for share links: explicit env in dev/preview, request origin otherwise. */
function baseUrl(request: Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL
  return new URL(request.url).origin
}

// POST /api/pulse/pulses — create a pulse, standalone or scoped to a crew.
// The "when" is two absolute ISO instants resolved client-side from the creator's local wall clock:
// `startAt` (start) and `endsAt` (end — stored as expires_at), plus the creator's IANA `timezone`.
// The human `time_label` is DERIVED server-side from them (deriveWhenLabel) so machine and displayed
// time can never diverge. Idempotent on `clientUuid` so a double-tap/retry makes one pulse. The
// response ALWAYS includes the prewritten chat-drop message + URL and the delivery facts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, CAPS.pulseTitle) : ''
  const place = typeof body?.place === 'string' ? body.place.trim().slice(0, CAPS.pulsePlace) : ''
  if (!title || !place) return Response.json({ error: 'title, place required' }, { status: 400 })

  // The window: start < end, and the end must still be in the future (a past/closed window is
  // rejected). A start slightly in the past is fine — a "Now" pulse's start is the creation instant,
  // which network latency can nudge just behind server `now`; it's already live, not invalid.
  const startAt = typeof body?.startAt === 'string' ? new Date(body.startAt) : new Date(NaN)
  const endsAt = typeof body?.endsAt === 'string' ? new Date(body.endsAt) : new Date(NaN)
  const timezone = typeof body?.timezone === 'string' ? body.timezone.slice(0, 64) : null
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return Response.json({ error: 'startAt and endsAt must be ISO instants' }, { status: 400 })
  }
  if (startAt.getTime() >= endsAt.getTime() || endsAt.getTime() <= Date.now()) {
    return Response.json({ error: 'the pulse window must end in the future' }, { status: 400 })
  }
  const timeLabel = deriveWhenLabel(startAt, endsAt, timezone ?? 'UTC').slice(0, CAPS.pulseTimeLabel)

  // Optional venue facts (add-restaurant-pods): facts about the venue, never a gate on people.
  // seatsCap is a positive int; countNeededBy is an ISO instant resolved from the creator's local
  // wall clock that must fall before the window ends (before start or within the window is fine).
  let seatsCap: number | null = null
  if (body?.seatsCap !== undefined && body?.seatsCap !== null) {
    if (!Number.isInteger(body.seatsCap) || body.seatsCap <= 0 || body.seatsCap > 500) {
      return Response.json({ error: 'seatsCap must be a positive integer' }, { status: 400 })
    }
    seatsCap = body.seatsCap
  }
  let countNeededBy: Date | null = null
  if (body?.countNeededBy !== undefined && body?.countNeededBy !== null) {
    const cutoff = typeof body.countNeededBy === 'string' ? new Date(body.countNeededBy) : new Date(NaN)
    if (Number.isNaN(cutoff.getTime())) {
      return Response.json({ error: 'countNeededBy must be an ISO instant' }, { status: 400 })
    }
    if (cutoff.getTime() > endsAt.getTime()) {
      return Response.json({ error: 'countNeededBy must fall before the pulse ends' }, { status: 400 })
    }
    countNeededBy = cutoff
  }

  const clientUuid = typeof body?.clientUuid === 'string' ? body.clientUuid : ''
  if (!UUID.test(clientUuid)) return Response.json({ error: 'clientUuid required' }, { status: 400 })

  // The client holds the crew token (from the board URL), not its internal id.
  let crewId: string | null = null
  const crewToken = typeof body?.crewToken === 'string' ? body.crewToken : null
  if (crewToken) {
    const crew = await repo.getCrewByToken(crewToken)
    if (!crew) return Response.json({ error: 'crew not found' }, { status: 404 })
    crewId = crew.id
  }

  const participant = await resolveOrCreateParticipant()

  const limited = await enforceRateLimit('create', {
    participantId: participant.id, crewId: crewId ?? undefined, ip: clientIp(request),
  })
  if (limited) return limited

  const pulse = await repo.createPulse({
    token: newToken(), crewId, title, place, timeLabel,
    startAt, expiresAt: endsAt, timezone,
    createdBy: participant.id, clientUuid,
    seatsCap, countNeededBy,
  })

  // Geocode after the response — creation never waits on the provider (spec: "geocoding never
  // blocks creation"). geocode() never throws; a real result lands via setPulseGeo, whose version
  // bump reaches viewers through the existing poll. The idempotent-retry path (pulse already
  // geocoded) is skipped so a double-tap can't re-bump the version.
  after(async () => {
    if (pulse.placeGeoStatus !== 'unresolved') return
    const geo = await geocode(place)
    if (geo.status === 'unresolved') return
    await repo.setPulseGeo(pulse.id, geo.lat, geo.lng, geo.status)
  })
  after(() => repo.logEvent('pulse_create', { pulseId: pulse.id, crewId, participantId: participant.id }))

  // Delivery facts for the composer's delivery step. "Text the crew" exists only when the
  // pulse is crew-scoped and the creator is a verified member; quiet hours block it visibly.
  const url = `${baseUrl(request)}/p/s/${pulse.token}`
  let sms: { available: boolean; memberCount: number; quietHours: boolean } = {
    available: false, memberCount: 0, quietHours: false,
  }
  if (crewId && isVerified(participant) && (await repo.isCrewMember(crewId, participant.id))) {
    const members = await repo.membersForCrew(crewId)
    const browserTz = typeof body?.timezone === 'string' ? body.timezone : null
    const quiet = inQuietHours(new Date(), await quietHoursTimezone(participant.id, browserTz))
    sms = { available: !quiet, memberCount: members.length - 1, quietHours: quiet }
  }

  return Response.json({
    token: pulse.token,
    path: `/p/s/${pulse.token}`,
    url,
    // The machine-derived display snapshot, so an optimistic client card can show it without a read.
    timeLabel: pulse.timeLabel,
    message: pulseMessage(title, place, timeLabel, url),
    // The creator's own tier, so the delivery screen can decide whether to offer the save step
    // without an extra round-trip. Additive — no existing consumer reads it.
    verified: isVerified(participant),
    sms,
  })
}

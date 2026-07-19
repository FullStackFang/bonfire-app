import { after } from 'next/server'
import { resolveOrCreateParticipant, isVerified } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { newToken } from '@/lib/ids'
import { CAPS, pulseMessage } from '@/lib/pulse/copy'
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
// `expiresAt` is an absolute ISO instant resolved client-side from the creator's timezone.
// Idempotent on `clientUuid` so a double-tap/retry over a flaky in-app connection makes one pulse.
// The response ALWAYS includes the prewritten chat-drop message + URL (the free delivery path)
// and the delivery facts the composer needs for the optional "Text the crew" step.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, CAPS.pulseTitle) : ''
  const place = typeof body?.place === 'string' ? body.place.trim().slice(0, CAPS.pulsePlace) : ''
  const timeLabel = typeof body?.timeLabel === 'string' ? body.timeLabel.trim().slice(0, CAPS.pulseTimeLabel) : ''
  if (!title || !place || !timeLabel) return Response.json({ error: 'title, place, time required' }, { status: 400 })

  const expiresAt = typeof body?.expiresAt === 'string' ? new Date(body.expiresAt) : new Date(NaN)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return Response.json({ error: 'expiresAt must be a future instant' }, { status: 400 })
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
    token: newToken(), crewId, title, place, timeLabel, expiresAt,
    createdBy: participant.id, clientUuid,
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
    message: pulseMessage(title, place, timeLabel, url),
    // The creator's own tier, so the delivery screen can decide whether to offer the save step
    // without an extra round-trip. Additive — no existing consumer reads it.
    verified: isVerified(participant),
    sms,
  })
}

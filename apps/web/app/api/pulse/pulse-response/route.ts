import { resolveOrCreateParticipant, setDisplayName, toPublicViewer } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { CAPS } from '@/lib/pulse/copy'
import { PULSE_STATUSES } from '@/lib/pulse/types'
import { isLive } from '@/lib/pulse/time'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'

// PUT /api/pulse/pulse-response — set this device's response on a pulse (status + optional
// ETA on "on my way" + optional note on "here"). Upsert: current-only.
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const status = body?.status
  if (!PULSE_STATUSES.includes(status)) return Response.json({ error: 'bad status' }, { status: 400 })

  const pulse = await repo.getPulseByToken(typeof body?.pulseToken === 'string' ? body.pulseToken : '')
  if (!pulse) return Response.json({ error: 'pulse not found' }, { status: 404 })
  if (!isLive(pulse, new Date())) return Response.json({ error: 'pulse is not live' }, { status: 409 })

  let participant = await resolveOrCreateParticipant()
  const nameInput = typeof body?.name === 'string' ? body.name.trim() : ''
  const hadName = !!participant.displayName
  if (nameInput) {
    participant = await setDisplayName(participant.id, nameInput)
    if (!hadName) await repo.logEvent('name_set', { pulseId: pulse.id, participantId: participant.id })
  }
  if (!participant.displayName) return Response.json({ error: 'name required' }, { status: 422 })

  const limited = await enforceRateLimit('mutate', {
    participantId: participant.id, crewId: pulse.crewId ?? undefined, ip: clientIp(request),
  })
  if (limited) return limited

  const etaRaw = body?.etaMinutes
  const eta = status === 'on_my_way' && Number.isInteger(etaRaw) && etaRaw > 0 && etaRaw <= 180
    ? (etaRaw as number) : null
  const note = typeof body?.note === 'string' && body.note.trim()
    ? body.note.trim().slice(0, CAPS.note) : null
  // Optional party size (add-restaurant-pods): 0–3 guests riding on this response. Absent = keep
  // the current value — the one-tap join and later status taps never reset a chosen party.
  const partyRaw = body?.partySize
  const partySize = Number.isInteger(partyRaw) && partyRaw >= 0 && partyRaw <= 3
    ? (partyRaw as number) : null

  await repo.upsertResponse(pulse, participant.id, status, eta, note, partySize)
  await repo.logEvent('status_set', { pulseId: pulse.id, crewId: pulse.crewId, participantId: participant.id })

  return Response.json({ ok: true, viewer: toPublicViewer(participant) })
}

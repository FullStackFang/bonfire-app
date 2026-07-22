import { resolveOrCreateParticipant, setDisplayName } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { CAPS } from '@/lib/pulse/copy'
import { POD_KINDS, type PodKind } from '@/lib/pulse/types'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'

// Pod writes (add-restaurant-pods). Egalitarian per design D5: anyone with the pulse link + a
// participant identity can open a pod (no host role, tier-0 included); only the OWNER may edit or
// disband. Nothing here notifies anyone — pod changes surface via the pulse version bump + poll.

const podError = (error: repo.PodWriteError): Response => {
  const status =
    error === 'not_owner' ? 403
    : error === 'pod_not_found' || error === 'not_member' ? 404
    : 409 // pulse_over | pod_full | seats_below_members
  return Response.json({ error }, { status })
}

const parseSeats = (raw: unknown): number | null | undefined => {
  if (raw === undefined) return undefined // absent — leave as-is (edit) / uncapped (open)
  if (raw === null) return null // explicit uncapped
  return Number.isInteger(raw) && (raw as number) > 0 && (raw as number) <= 50 ? (raw as number) : undefined
}

async function loadPulse(body: { pulseToken?: unknown }) {
  return repo.getPulseByToken(typeof body?.pulseToken === 'string' ? body.pulseToken : '')
}

// POST /api/pulse/pod — open a pod. The opener becomes owner-member (moving them out of any
// pod they were in). Accepts an optional `name` for first-touch identities, like pulse-response.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const kind = body?.kind
  if (!POD_KINDS.includes(kind)) return Response.json({ error: 'bad kind' }, { status: 400 })
  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, CAPS.podLabel) : ''
  if (!label) return Response.json({ error: 'label required' }, { status: 400 })
  const seats = parseSeats(body?.seats) ?? null

  const pulse = await loadPulse(body)
  if (!pulse) return Response.json({ error: 'pulse not found' }, { status: 404 })

  let participant = await resolveOrCreateParticipant()
  const nameInput = typeof body?.name === 'string' ? body.name.trim() : ''
  if (nameInput) participant = await setDisplayName(participant.id, nameInput)
  if (!participant.displayName) return Response.json({ error: 'name required' }, { status: 422 })

  const limited = await enforceRateLimit('mutate', {
    participantId: participant.id, crewId: pulse.crewId ?? undefined, ip: clientIp(request),
  })
  if (limited) return limited

  const result = await repo.createPod(pulse, participant.id, kind as PodKind, label, seats, new Date())
  if (!result.ok) return podError(result.error)
  return Response.json({ ok: true, podId: result.value.id })
}

// PATCH /api/pulse/pod — owner-only label/seats edit. Shrinking below the member count is refused.
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const podId = typeof body?.podId === 'string' ? body.podId : ''
  if (!podId) return Response.json({ error: 'podId required' }, { status: 400 })
  const patch: { label?: string; seats?: number | null } = {}
  if (typeof body?.label === 'string' && body.label.trim()) {
    patch.label = body.label.trim().slice(0, CAPS.podLabel)
  }
  const seats = parseSeats(body?.seats)
  if (seats !== undefined) patch.seats = seats

  const pulse = await loadPulse(body)
  if (!pulse) return Response.json({ error: 'pulse not found' }, { status: 404 })

  const participant = await resolveOrCreateParticipant()
  const limited = await enforceRateLimit('mutate', {
    participantId: participant.id, crewId: pulse.crewId ?? undefined, ip: clientIp(request),
  })
  if (limited) return limited

  const result = await repo.updatePod(pulse, podId, participant.id, patch, new Date())
  if (!result.ok) return podError(result.error)
  return Response.json({ ok: true })
}

// DELETE /api/pulse/pod — owner-only disband. Members just fall out; nothing is sent.
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const podId = typeof body?.podId === 'string' ? body.podId : ''
  if (!podId) return Response.json({ error: 'podId required' }, { status: 400 })

  const pulse = await loadPulse(body)
  if (!pulse) return Response.json({ error: 'pulse not found' }, { status: 404 })

  const participant = await resolveOrCreateParticipant()
  const limited = await enforceRateLimit('mutate', {
    participantId: participant.id, crewId: pulse.crewId ?? undefined, ip: clientIp(request),
  })
  if (limited) return limited

  const result = await repo.deletePod(pulse, podId, participant.id, new Date())
  if (!result.ok) return podError(result.error)
  return Response.json({ ok: true })
}

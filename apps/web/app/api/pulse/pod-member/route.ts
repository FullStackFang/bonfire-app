import { resolveOrCreateParticipant, setDisplayName } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'

// Pod membership (add-restaurant-pods). One pod per participant per pulse: joining while in
// another pod atomically MOVES the membership (the response tells the mover). Only yourself can
// be removed by you — leave always operates on the viewer's own membership. Nothing notifies.

const podError = (error: repo.PodWriteError): Response => {
  const status =
    error === 'pod_not_found' || error === 'not_member' ? 404
    : error === 'not_owner' ? 403
    : 409 // pulse_over | pod_full
  return Response.json({ error }, { status })
}

// PUT /api/pulse/pod-member — join (or move into) a pod. A full pod refuses (409, no waitlist).
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const podId = typeof body?.podId === 'string' ? body.podId : ''
  if (!podId) return Response.json({ error: 'podId required' }, { status: 400 })

  const pulse = await repo.getPulseByToken(typeof body?.pulseToken === 'string' ? body.pulseToken : '')
  if (!pulse) return Response.json({ error: 'pulse not found' }, { status: 404 })

  let participant = await resolveOrCreateParticipant()
  const nameInput = typeof body?.name === 'string' ? body.name.trim() : ''
  if (nameInput) participant = await setDisplayName(participant.id, nameInput)
  if (!participant.displayName) return Response.json({ error: 'name required' }, { status: 422 })

  const limited = await enforceRateLimit('mutate', {
    participantId: participant.id, crewId: pulse.crewId ?? undefined, ip: clientIp(request),
  })
  if (limited) return limited

  const result = await repo.joinPod(pulse, podId, participant.id, new Date())
  if (!result.ok) return podError(result.error)
  return Response.json({ ok: true, moved: result.value.moved })
}

// DELETE /api/pulse/pod-member — leave a pod (self only, quiet).
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const podId = typeof body?.podId === 'string' ? body.podId : ''
  if (!podId) return Response.json({ error: 'podId required' }, { status: 400 })

  const pulse = await repo.getPulseByToken(typeof body?.pulseToken === 'string' ? body.pulseToken : '')
  if (!pulse) return Response.json({ error: 'pulse not found' }, { status: 404 })

  const participant = await resolveOrCreateParticipant()
  const limited = await enforceRateLimit('mutate', {
    participantId: participant.id, crewId: pulse.crewId ?? undefined, ip: clientIp(request),
  })
  if (limited) return limited

  const result = await repo.leavePod(pulse, podId, participant.id, new Date())
  if (!result.ok) return podError(result.error)
  return Response.json({ ok: true })
}

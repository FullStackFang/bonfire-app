import { resolveOrCreateParticipant, requireVerified } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'

// Explicit crew membership. Joining is a DURABLE act (verified tier); leaving is a quiet
// single act. Neither sends any notification, ever — the roster just changes and the crew
// version bump lets pollers pick it up.

// PUT /api/pulse/crew-membership — join. Idempotent.
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const crew = await repo.getCrewByToken(typeof body?.crewToken === 'string' ? body.crewToken : '')
  if (!crew) return Response.json({ error: 'crew not found' }, { status: 404 })

  const participant = await resolveOrCreateParticipant()
  const gate = requireVerified(participant)
  if (gate) return gate

  const limited = await enforceRateLimit('mutate', {
    participantId: participant.id, crewId: crew.id, ip: clientIp(request),
  })
  if (limited) return limited

  await repo.addCrewMember(crew.id, participant.id)
  return Response.json({ ok: true })
}

// DELETE /api/pulse/crew-membership — quiet leave.
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const crew = await repo.getCrewByToken(typeof body?.crewToken === 'string' ? body.crewToken : '')
  if (!crew) return Response.json({ error: 'crew not found' }, { status: 404 })

  const participant = await resolveOrCreateParticipant()
  const gate = requireVerified(participant)
  if (gate) return gate

  await repo.removeCrewMember(crew.id, participant.id)
  return Response.json({ ok: true })
}

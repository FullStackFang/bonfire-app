import { resolveOrCreateParticipant } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'

// PUT /api/pulse/table-called — record that someone phoned the venue. Egalitarian like wrap:
// anyone with the link may tap it. Idempotent (first set wins) and it triggers NO notification —
// the timestamp lands on the pulse and viewers see it on their next poll.
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const pulse = await repo.getPulseByToken(typeof body?.pulseToken === 'string' ? body.pulseToken : '')
  if (!pulse) return Response.json({ error: 'pulse not found' }, { status: 404 })
  // Only a pulse with venue facts offers the marker (spec: table-called requires venue facts).
  if (pulse.seatsCap == null && pulse.countNeededBy == null) {
    return Response.json({ error: 'no venue facts' }, { status: 409 })
  }

  const participant = await resolveOrCreateParticipant()
  const limited = await enforceRateLimit('mutate', {
    participantId: participant.id, crewId: pulse.crewId ?? undefined, ip: clientIp(request),
  })
  if (limited) return limited

  await repo.setTableCalled(pulse.id)
  return Response.json({ ok: true })
}

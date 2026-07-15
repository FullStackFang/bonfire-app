import { resolveOrCreateParticipant } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'

// PUT /api/pulse/pulse-wrap — close a pulse with a quiet summary. Idempotent. No host role in v1:
// anyone with the link may wrap. After wrapping, responses are blocked (pulse-response 409s).
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const pulse = await repo.getPulseByToken(typeof body?.pulseToken === 'string' ? body.pulseToken : '')
  if (!pulse) return Response.json({ error: 'pulse not found' }, { status: 404 })

  const participant = await resolveOrCreateParticipant()
  const limited = await enforceRateLimit('mutate', {
    participantId: participant.id, crewId: pulse.crewId ?? undefined, ip: clientIp(request),
  })
  if (limited) return limited

  await repo.closePulse(pulse)
  const responses = await repo.responsesForPulse(pulse.id)
  const madeItCount = responses.filter((p) => p.status === 'here').length
  await repo.logEvent('pulse_wrap', { pulseId: pulse.id, crewId: pulse.crewId, participantId: participant.id })

  return Response.json({ ok: true, summary: { madeItCount } })
}

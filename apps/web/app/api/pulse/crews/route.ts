import { resolveOrCreateParticipant, requireVerified } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { newToken } from '@/lib/ids'
import { CAPS } from '@/lib/pulse/copy'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'

// POST /api/pulse/crews — create a crew. A DURABLE act: requires the verified phone tier.
// The creator is auto-added to the roster. (Tier-0 consumption — opening links, board
// presence, pulse responses — is untouched by this gate.)
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, CAPS.crewName) : ''
  if (!name) return Response.json({ error: 'name required' }, { status: 400 })

  const participant = await resolveOrCreateParticipant()
  const gate = requireVerified(participant)
  if (gate) return gate

  const limited = await enforceRateLimit('create', { participantId: participant.id, ip: clientIp(request) })
  if (limited) return limited

  const crew = await repo.createCrew(newToken(), name, participant.id)
  await repo.addCrewMember(crew.id, participant.id)
  await repo.logEvent('crew_create', { crewId: crew.id, participantId: participant.id })

  return Response.json({ token: crew.token, path: `/p/c/${crew.token}` })
}

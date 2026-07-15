import { resolveOrCreateParticipant, setDisplayName, toPublicViewer } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { CAPS } from '@/lib/pulse/copy'
import { BOARD_STATUSES } from '@/lib/pulse/types'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'

// PUT /api/pulse/presence — set this device's board status (+ optional note). Upsert: current-only.
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const status = body?.status
  if (!BOARD_STATUSES.includes(status)) return Response.json({ error: 'bad status' }, { status: 400 })

  const crew = await repo.getCrewByToken(typeof body?.crewToken === 'string' ? body.crewToken : '')
  if (!crew) return Response.json({ error: 'crew not found' }, { status: 404 })

  let participant = await resolveOrCreateParticipant()

  // First action that needs an identity asks for a name once; later actions need no re-entry.
  const nameInput = typeof body?.name === 'string' ? body.name.trim() : ''
  const hadName = !!participant.displayName
  if (nameInput && !hadName) {
    participant = await setDisplayName(participant.id, nameInput)
    await repo.logEvent('name_set', { crewId: crew.id, participantId: participant.id })
  } else if (nameInput) {
    participant = await setDisplayName(participant.id, nameInput) // one-tap re-name/re-claim
  }
  if (!participant.displayName) return Response.json({ error: 'name required' }, { status: 422 })

  const limited = await enforceRateLimit('mutate', {
    participantId: participant.id, crewId: crew.id, ip: clientIp(request),
  })
  if (limited) return limited

  const note = typeof body?.note === 'string' && body.note.trim()
    ? body.note.trim().slice(0, CAPS.note) : null

  await repo.upsertPresence(crew.id, participant.id, status, note)
  await repo.logEvent('status_set', { crewId: crew.id, participantId: participant.id })

  return Response.json({ ok: true, viewer: toPublicViewer(participant) })
}

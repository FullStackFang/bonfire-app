import { getViewer, resolveOrCreateParticipant, toPublicViewer } from '@/lib/pulse/identity'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'
import { getPublicReconnect, setEnabled, mute, markShown } from '@/lib/pulse/reconnect'

export const dynamic = 'force-dynamic'

// GET — the viewer's reconnect state (opt-in flag + at most one suggestion).
export async function GET() {
  const viewer = await getViewer()
  return Response.json({ reconnect: await getPublicReconnect(toPublicViewer(viewer)) })
}

// POST { action: 'enable'|'disable'|'mute'|'dismiss', participantId? } — opt in/out, mute a person,
// or snooze (dismiss respects the cadence cap). Nothing here messages anyone.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const participant = await resolveOrCreateParticipant()

  const limited = await enforceRateLimit('mutate', { participantId: participant.id, ip: clientIp(request) })
  if (limited) return limited

  const action = body?.action
  if (action === 'enable') await setEnabled(participant.id, true)
  else if (action === 'disable') await setEnabled(participant.id, false)
  else if (action === 'mute' && typeof body?.participantId === 'string') await mute(participant.id, body.participantId)
  else if (action === 'dismiss') await markShown(participant.id)
  else return Response.json({ error: 'unknown action' }, { status: 400 })

  return Response.json({ reconnect: await getPublicReconnect(toPublicViewer(participant)) })
}

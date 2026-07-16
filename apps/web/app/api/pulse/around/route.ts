import { resolveOrCreateParticipant, toPublicViewer } from '@/lib/pulse/identity'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'
import { setAround, clearAround, getPublicAround } from '@/lib/pulse/around'
import { AROUND_WINDOWS, type AroundWindow } from '@/lib/pulse/types'

// POST /api/pulse/around — set or clear the viewer's coarse "I'm around" signal (no device location).
// { window, locale? } to set; { clear: true } to go quiet. Identity is the cookie participant.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const participant = await resolveOrCreateParticipant()

  const limited = await enforceRateLimit('mutate', { participantId: participant.id, ip: clientIp(request) })
  if (limited) return limited

  if (body?.clear === true) {
    await clearAround(participant.id)
  } else {
    const window = body?.window as AroundWindow
    if (!AROUND_WINDOWS.includes(window)) {
      return Response.json({ error: 'window must be now, tonight, or this_week' }, { status: 400 })
    }
    const locale = typeof body?.locale === 'string' ? body.locale : null
    await setAround(participant.id, window, locale)
  }

  return Response.json({ around: await getPublicAround(toPublicViewer(participant)) })
}

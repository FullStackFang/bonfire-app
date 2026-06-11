import { sessionFromBody } from '@/lib/asker/auth'
import * as repo from '@/lib/asker/repo'

const ALLOWED = ['in', 'confirmed', 'out', 'omw', 'here'] as const

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { session, body } = auth
  const state = body?.state
  const eta = Number.isInteger(body?.etaMinutes) ? (body.etaMinutes as number) : null
  if (!ALLOWED.includes(state)) return Response.json({ error: 'bad state' }, { status: 400 })
  const event = await repo.getEvent(eventId).catch(() => null)
  if (!event || event.circleId !== session.circle.id) return Response.json({ error: 'not found' }, { status: 404 })
  if (event.state !== 'on') return Response.json({ error: 'event is not live' }, { status: 409 })
  const existing = (await repo.attendanceForEvent(eventId)).find((a) => a.memberId === session.member.id)
  if (state === 'in' && existing && ['confirmed', 'omw', 'here'].includes(existing.state)) {
    return Response.json({ error: 'already in' }, { status: 409 })
  }
  await repo.setAttendance(eventId, session.member.id, state, state === 'omw' ? eta : null)
  return Response.json({ ok: true })
}

import { sessionFromBody } from '@/lib/asker/auth'
import * as repo from '@/lib/asker/repo'

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { session, body } = auth
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!name) return Response.json({ error: 'venue name required' }, { status: 400 })
  const event = await repo.getEvent(eventId).catch(() => null)
  if (!event || event.circleId !== session.circle.id) return Response.json({ error: 'not found' }, { status: 404 })
  await repo.setEventVenue(eventId, session.circle.id, name)
  return Response.json({ ok: true })
}

import { sessionFromBody } from '@/lib/asker/auth'
import * as repo from '@/lib/asker/repo'

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (typeof auth.body?.wouldHaveHappened !== 'boolean') {
    return Response.json({ error: 'wouldHaveHappened boolean required' }, { status: 400 })
  }
  const event = await repo.getEvent(eventId).catch(() => null)
  if (!event || event.circleId !== auth.session.circle.id) return Response.json({ error: 'not found' }, { status: 404 })
  await repo.insertExitPoll(eventId, auth.session.member.id, auth.body.wouldHaveHappened)
  return Response.json({ ok: true })
}

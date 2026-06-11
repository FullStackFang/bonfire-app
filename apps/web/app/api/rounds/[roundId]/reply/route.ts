import { sessionFromBody } from '@/lib/asker/auth'
import * as repo from '@/lib/asker/repo'
import { sendStrikeBroadcast } from '@/lib/asker/tick'

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { session, body } = auth
  const answer = body?.answer
  if (!['in', 'out', 'later'].includes(answer)) return Response.json({ error: 'bad answer' }, { status: 400 })

  const round = await repo.getRound(roundId).catch(() => null)
  if (!round || round.circleId !== session.circle.id || round.state === 'queued') {
    return Response.json({ error: 'not found' }, { status: 404 })
  }
  const now = new Date()
  const result = await repo.replyAndMaybeStrike(roundId, session.member.id, answer, now)
  if (result.kind === 'struck') {
    await sendStrikeBroadcast(result.eventId, now)
    return Response.json({ state: 'struck', eventId: result.eventId })
  }
  return Response.json({ state: result.kind }) // 'recorded' | 'closed'
}

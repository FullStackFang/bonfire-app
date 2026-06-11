import { sessionFromBody } from '@/lib/asker/auth'
import * as repo from '@/lib/asker/repo'
import { nextOccurrence } from '@/lib/asker/time'

export async function POST(request: Request) {
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { session, body } = auth
  const verb = session.circle.verbSet.find((v) => v.emoji === body?.verbEmoji)
  const dow = Number(body?.proposeDow)
  const hour = Number(body?.proposeHour)
  const detail = typeof body?.detail === 'string' && body.detail.trim() ? body.detail.trim().slice(0, 80) : null
  if (!verb || !Number.isInteger(dow) || dow < 0 || dow > 6 || !Number.isInteger(hour) || hour < 7 || hour > 23) {
    return Response.json({ error: 'verb, proposeDow (0-6), proposeHour (7-23) required' }, { status: 400 })
  }
  const now = new Date()
  const proposedAt = nextOccurrence(now, dow, hour)
  const round = await repo.insertRound({
    circleId: session.circle.id, verbEmoji: verb.emoji, verbLabel: verb.label,
    proposedAt, closesAt: new Date(proposedAt.getTime() - 2 * 3600_000),
    detail, source: 'kindled', state: 'queued', cadenceSlot: null,
  })
  if (!round) return Response.json({ error: 'could not kindle' }, { status: 500 })
  await repo.insertReply(round.id, session.member.id, 'in') // the kindler's invisible auto-in
  // Deliberately no round id in the response and no special UI state:
  // the round surfaces at the next send window looking exactly like a scheduled ask.
  return Response.json({ ok: true })
}

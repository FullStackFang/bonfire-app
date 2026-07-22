import { getViewer, resolveOrCreateParticipant } from '@/lib/pulse/identity'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'
import { getPlanByToken, resolvePlanState } from '@/lib/pulse/plan'
import { canTapPerson, tapPerson, untapPerson, personFacesForPlan } from '@/lib/pulse/person-intent'

export const dynamic = 'force-dynamic'

// The person-intent tap (add-intent-layer), zone two of the afterglow. POST { toParticipantId }
// records a directed "see them again"; DELETE withdraws it. Responses carry the viewer's OWN faces
// only — personFacesForPlan enforces visibility structurally (one-sided-toward-you is invisible,
// mutual reveals symmetrically). Tier-0 participants qualify — holding the link and having marked
// the winning option is the whole gate, no account required.

async function resolvedPlan(token: string) {
  const plan = await getPlanByToken(token)
  return plan ? resolvePlanState(plan, new Date()) : null
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const plan = await resolvedPlan(token)
  if (!plan) return Response.json({ error: 'not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const toId = typeof body?.toParticipantId === 'string' ? body.toParticipantId : ''
  if (!toId) return Response.json({ error: 'no target' }, { status: 400 })

  const participant = await resolveOrCreateParticipant()
  const limited = await enforceRateLimit('mutate', { participantId: participant.id, ip: clientIp(request) })
  if (limited) return limited

  // Server-side eligibility: completed plan + BOTH endpoints marked the winning option.
  if (!(await canTapPerson(plan, participant.id, toId))) {
    return Response.json({ error: 'not eligible' }, { status: 403 })
  }
  await tapPerson(plan, participant.id, toId)
  return Response.json({ faces: await personFacesForPlan(plan, participant.id) })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const plan = await resolvedPlan(token)
  if (!plan) return Response.json({ error: 'not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const toId = typeof body?.toParticipantId === 'string' ? body.toParticipantId : ''

  // No identity -> nothing to withdraw (never mint a participant on an un-tap).
  const viewer = await getViewer()
  if (!viewer) return Response.json({ faces: [] })
  const limited = await enforceRateLimit('mutate', { participantId: viewer.id, ip: clientIp(request) })
  if (limited) return limited

  if (toId) await untapPerson(viewer.id, toId)
  return Response.json({ faces: await personFacesForPlan(plan, viewer.id) })
}

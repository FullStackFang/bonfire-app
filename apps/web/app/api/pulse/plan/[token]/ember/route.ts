import { getViewer, resolveOrCreateParticipant } from '@/lib/pulse/identity'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'
import { getPlanByToken, resolvePlanState } from '@/lib/pulse/plan'
import { canTapEmber, tapEmber, untapEmber, getPublicEmber } from '@/lib/pulse/ember'

export const dynamic = 'force-dynamic'

// The "again" tap (close-plan-loop). GET returns the viewer's OWN ember standing only —
// getPublicEmber enforces visibility structurally (non-tappers get the empty shape; co-tapper
// names only when mutual). POST records a tap; DELETE withdraws it. Tier-0 participants qualify —
// no account, no verification: holding the link and having marked the winning option is the gate.

async function resolvedPlan(token: string) {
  const plan = await getPlanByToken(token)
  return plan ? resolvePlanState(plan, new Date()) : null
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const plan = await resolvedPlan(token)
  if (!plan) return Response.json({ error: 'not found' }, { status: 404 })
  const viewer = await getViewer()
  return Response.json({ ember: await getPublicEmber(plan.id, viewer?.id ?? null) })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const plan = await resolvedPlan(token)
  if (!plan) return Response.json({ error: 'not found' }, { status: 404 })

  const participant = await resolveOrCreateParticipant()
  const limited = await enforceRateLimit('mutate', { participantId: participant.id, ip: clientIp(request) })
  if (limited) return limited

  // Server-side eligibility: completed plan + the viewer marked the winning option.
  if (!(await canTapEmber(plan, participant.id))) {
    return Response.json({ error: 'not eligible' }, { status: 403 })
  }
  await tapEmber(plan, participant.id)
  return Response.json({ ember: await getPublicEmber(plan.id, participant.id) })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const plan = await resolvedPlan(token)
  if (!plan) return Response.json({ error: 'not found' }, { status: 404 })

  // No identity -> nothing to withdraw (never mint a participant on an un-tap).
  const viewer = await getViewer()
  if (!viewer) return Response.json({ ember: { tapped: false, mutual: false, coTappers: [] } })
  const limited = await enforceRateLimit('mutate', { participantId: viewer.id, ip: clientIp(request) })
  if (limited) return limited

  await untapEmber(plan, viewer.id)
  return Response.json({ ember: await getPublicEmber(plan.id, viewer.id) })
}

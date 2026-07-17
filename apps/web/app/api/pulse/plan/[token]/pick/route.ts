import { resolveOrCreateParticipant, toPublicViewer } from '@/lib/pulse/identity'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'
import { getPlanByToken, resolvePlanState, recordAvailabilityAndMaybeStrike, getPublicPlanByToken } from '@/lib/pulse/plan'

// POST /api/pulse/plan/[token]/pick — an invitee marks availability for an option (C1-C: availability,
// never RSVP; there is no decline path). No account required — a tier-0 ghost participant is minted
// on first interaction. Recording may cross the confirmation threshold and strike the plan.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await request.json().catch(() => null)
  const optionId = typeof body?.optionId === 'string' ? body.optionId : ''
  if (!optionId) return Response.json({ error: 'optionId required' }, { status: 400 })

  let plan = await getPlanByToken(token)
  if (!plan) return Response.json({ error: 'not found' }, { status: 404 })
  // Heal state first: a pick arriving past the deadline resolves the plan (auto-strike/expire)
  // rather than landing on a stale `open` row; recordAvailability then correctly reports closed.
  plan = await resolvePlanState(plan, new Date())

  const participant = await resolveOrCreateParticipant()
  const limited = await enforceRateLimit('mutate', { participantId: participant.id, ip: clientIp(request) })
  if (limited) return limited

  const result = await recordAvailabilityAndMaybeStrike(plan.id, optionId, participant.id, new Date())
  if (result.kind === 'invalid') return Response.json({ error: 'unknown option' }, { status: 400 })
  if (result.kind === 'closed') return Response.json({ error: 'this plan is already settled' }, { status: 409 })

  return Response.json({
    result: result.kind,
    plan: await getPublicPlanByToken(token, toPublicViewer(participant)),
  })
}

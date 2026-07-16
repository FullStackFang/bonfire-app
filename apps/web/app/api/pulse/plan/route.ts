import { resolveOrCreateParticipant, toPublicViewer } from '@/lib/pulse/identity'
import { newToken } from '@/lib/ids'
import { enforceRateLimit, clientIp } from '@/lib/pulse/ratelimit'
import { createPlan, setOptions, getPublicPlanByToken } from '@/lib/pulse/plan'
import { proposeOptions } from '@/lib/pulse/plan-ai'

const INTENT_MAX = 500

// POST /api/pulse/plan — the opener states intent; the AI proposes candidate options; a plan is
// created in `proposing` state (link not yet shared). Identity is the tier-0/verified cookie
// participant. proposeOptions never throws — a missing key or model error yields fallback options,
// so create never hard-fails.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const intent = typeof body?.intent === 'string' ? body.intent.trim().slice(0, INTENT_MAX) : ''
  if (!intent) return Response.json({ error: 'say what you want to plan' }, { status: 400 })
  const locale = typeof body?.locale === 'string' ? body.locale.trim().slice(0, 80) : null
  const timezone = typeof body?.timezone === 'string' ? body.timezone.trim().slice(0, 64) : null

  const participant = await resolveOrCreateParticipant()
  const limited = await enforceRateLimit('create', { participantId: participant.id, ip: clientIp(request) })
  if (limited) return limited

  const options = await proposeOptions(intent, { locale, timezone, now: new Date() })
  const plan = await createPlan({
    token: newToken(), creatorParticipantId: participant.id, intentText: intent,
    context: locale ? { locale } : undefined,
  })
  await setOptions(plan.id, options)

  const pub = await getPublicPlanByToken(plan.token, toPublicViewer(participant))
  return Response.json({ token: plan.token, path: `/p/plan/${plan.token}`, plan: pub })
}

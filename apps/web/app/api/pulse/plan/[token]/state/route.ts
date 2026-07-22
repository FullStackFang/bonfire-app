import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { getPlanByToken, getPublicPlanByToken } from '@/lib/pulse/plan'
import { getPublicEmber } from '@/lib/pulse/ember'
import { personFacesForPlan } from '@/lib/pulse/person-intent'

export const dynamic = 'force-dynamic'

// GET /api/pulse/plan/[token]/state — poll target for the link view, so availability counts, the
// "it's on" strike, and the afterglow/mutual-ember reveal appear without a manual reload (mirrors
// the pulse rail's state poll). Read-only in intent; the read itself heals due lifecycle
// transitions (resolvePlanState inside getPublicPlanByToken). The ember payload is the viewer's
// own standing only — getPublicEmber enforces the silence-is-invisible rules.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const viewer = await getViewer()
  const plan = await getPublicPlanByToken(token, toPublicViewer(viewer))
  if (!plan) return Response.json({ error: 'not found' }, { status: 404 })
  const planRow = plan.state === 'completed' ? await getPlanByToken(token) : null
  const ember = planRow ? await getPublicEmber(planRow.id, viewer?.id ?? null) : null
  const faces = planRow ? await personFacesForPlan(planRow, viewer?.id ?? null) : []
  return Response.json({ plan, ember, faces })
}

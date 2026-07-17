import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { getPlanByToken, getPublicPlanByToken } from '@/lib/pulse/plan'
import { getPublicEmber } from '@/lib/pulse/ember'

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
  const ember = plan.state === 'completed'
    ? await getPublicEmber((await getPlanByToken(token))!.id, viewer?.id ?? null)
    : null
  return Response.json({ plan, ember })
}

import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { getPublicPlanByToken } from '@/lib/pulse/plan'

export const dynamic = 'force-dynamic'

// GET /api/pulse/plan/[token]/state — poll target for the link view, so availability counts and the
// "it's on" strike appear without a manual reload (mirrors the pulse rail's state poll). Read-only.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const viewer = await getViewer()
  const plan = await getPublicPlanByToken(token, toPublicViewer(viewer))
  if (!plan) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json({ plan })
}

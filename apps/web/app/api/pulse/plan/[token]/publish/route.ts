import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { getPlanByToken, publishPlan, getPublicPlanByToken } from '@/lib/pulse/plan'

function baseUrl(request: Request): string {
  return process.env.APP_BASE_URL || new URL(request.url).origin
}

// POST /api/pulse/plan/[token]/publish — the opener accepts the proposed options and mints the
// shareable link (proposing -> open). Only the creator (by cookie) may publish, only from proposing.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const viewer = await getViewer()
  if (!viewer) return Response.json({ error: 'only the opener can publish' }, { status: 403 })

  const plan = await getPlanByToken(token)
  if (!plan) return Response.json({ error: 'not found' }, { status: 404 })

  const published = await publishPlan(plan.id, viewer.id)
  if (!published) return Response.json({ error: 'this plan can’t be published' }, { status: 409 })

  return Response.json({
    url: `${baseUrl(request)}/p/plan/${token}`,
    path: `/p/plan/${token}`,
    plan: await getPublicPlanByToken(token, toPublicViewer(viewer)),
  })
}

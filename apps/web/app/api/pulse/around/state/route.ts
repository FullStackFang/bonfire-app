import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { getPublicAround } from '@/lib/pulse/around'

export const dynamic = 'force-dynamic'

// GET /api/pulse/around/state — poll target for the discovery roster (coarse; no distances).
export async function GET() {
  const viewer = await getViewer()
  return Response.json({ around: await getPublicAround(toPublicViewer(viewer)) })
}

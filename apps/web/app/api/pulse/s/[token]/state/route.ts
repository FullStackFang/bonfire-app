import * as repo from '@/lib/pulse/repo'
import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { serializePulse } from '@/lib/pulse/serialize'

export const dynamic = 'force-dynamic'

// GET pulse state for polling. The pulse's own `version` (bumped on every response/wrap)
// is the ETag; 304 (no body) when unchanged.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const pulse = await repo.getPulseByToken(token)
  if (!pulse) return Response.json({ error: 'not found' }, { status: 404 })

  const etag = `"s${pulse.version}"`
  const noStore = { 'Cache-Control': 'no-store', ETag: etag }
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: noStore })
  }

  const viewer = await getViewer()
  const now = new Date()
  const [responses, crew] = await Promise.all([
    repo.responsesForPulse(pulse.id),
    pulse.crewId ? repo.getCrewById(pulse.crewId) : Promise.resolve(null),
  ])
  const payload = serializePulse(pulse, responses, toPublicViewer(viewer), crew, now)
  return Response.json(payload, { headers: noStore })
}

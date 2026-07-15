import * as repo from '@/lib/pulse/repo'
import { getViewer, toPublicViewer } from '@/lib/pulse/identity'
import { serializeBoard } from '@/lib/pulse/serialize'

export const dynamic = 'force-dynamic'

// GET board state for polling. Cheap freshness check: one indexed read of crews.version as an
// ETag; 304 (no body) when unchanged. Only on a real change do we build the full snapshot.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const crew = await repo.getCrewByToken(token)
  if (!crew) return Response.json({ error: 'not found' }, { status: 404 })

  const etag = `"c${crew.version}"`
  const noStore = { 'Cache-Control': 'no-store', ETag: etag }
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: noStore })
  }

  const viewer = await getViewer()
  const now = new Date()
  const [presence, pulses, members] = await Promise.all([
    repo.presenceForCrew(crew.id),
    repo.activePulsesForCrew(crew.id, now),
    repo.membersForCrew(crew.id),
  ])
  const board = serializeBoard(crew, presence, pulses, members, toPublicViewer(viewer))
  return Response.json(board, { headers: noStore })
}

import { getViewer, setDisplayName, toPublicViewer } from '@/lib/pulse/identity'

// POST /api/pulse/name — set the viewer's display name (the login page's post-verify name
// step). Identity comes solely from the device cookie; NOT gated on requireVerified —
// presence/pulse-response already let unverified participants name themselves.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.name !== 'string') return Response.json({ error: 'name required' }, { status: 400 })

  const viewer = await getViewer()
  if (!viewer) return Response.json({ error: 'no identity' }, { status: 401 })

  if (!body.name.trim()) return Response.json({ error: 'enter a name' }, { status: 422 })

  const updated = await setDisplayName(viewer.id, body.name) // trims + caps at CAPS.displayName
  return Response.json({ ok: true, viewer: toPublicViewer(updated) })
}

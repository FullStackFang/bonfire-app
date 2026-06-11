import { sessionFromBody } from '@/lib/asker/auth'
import { logPageView } from '@/lib/asker/repo'

export async function POST(request: Request) {
  const auth = await sessionFromBody(request)
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const page = typeof auth.body?.page === 'string' ? auth.body.page.slice(0, 40) : 'unknown'
  await logPageView(auth.session.member.id, page)
  return Response.json({ ok: true })
}

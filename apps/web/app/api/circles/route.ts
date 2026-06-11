import { createCircle } from '@/lib/asker/repo'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const k = Number(body?.kThreshold)
  if (!name || name.length > 60 || ![2, 3, 4].includes(k)) {
    return Response.json({ error: 'name (≤60 chars) and kThreshold (2-4) required' }, { status: 400 })
  }
  const circle = await createCircle(name, k)
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000'
  return Response.json({ circleId: circle.id, joinUrl: `${base}/join/${circle.id}` })
}

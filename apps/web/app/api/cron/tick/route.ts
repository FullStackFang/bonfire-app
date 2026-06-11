import { runTick } from '@/lib/asker/tick'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const summary = await runTick(new Date())
  return Response.json(summary)
}

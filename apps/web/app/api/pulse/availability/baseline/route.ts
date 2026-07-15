import { getViewer, resolveOrCreateParticipant, requireVerified } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { CAPS } from '@/lib/pulse/copy'

// Baseline CRUD — a DURABLE act, gated on the verified phone tier. Deliberately passive:
// no notification code path exists in this file (or anywhere in availability).

export const dynamic = 'force-dynamic'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function isIanaTimezone(tz: string): boolean {
  if (typeof tz !== 'string' || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// GET — list the viewer's own baselines (never anyone else's).
export async function GET() {
  const viewer = await getViewer()
  const gate = requireVerified(viewer)
  if (gate) return gate
  const baselines = await repo.baselinesForParticipant(viewer!.id)
  return Response.json({
    baselines: baselines.map((b) => ({
      id: b.id, daysOfWeek: b.daysOfWeek, startTime: b.startTime.slice(0, 5),
      endTime: b.endTime.slice(0, 5), timezone: b.timezone, label: b.label,
    })),
  })
}

// POST — declare a recurring busy window.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const participant = await resolveOrCreateParticipant()
  const gate = requireVerified(participant)
  if (gate) return gate

  const daysOfWeek: unknown = body?.daysOfWeek
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0
    || !daysOfWeek.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    return Response.json({ error: 'daysOfWeek must be 0–6' }, { status: 400 })
  }
  const startTime = typeof body?.startTime === 'string' ? body.startTime : ''
  const endTime = typeof body?.endTime === 'string' ? body.endTime : ''
  if (!TIME.test(startTime) || !TIME.test(endTime)) {
    return Response.json({ error: 'times must be HH:MM' }, { status: 400 })
  }
  const timezone = typeof body?.timezone === 'string' ? body.timezone : ''
  if (!isIanaTimezone(timezone)) return Response.json({ error: 'invalid timezone' }, { status: 400 })
  const label = typeof body?.label === 'string' && body.label.trim()
    ? body.label.trim().slice(0, CAPS.availabilityLabel) : null

  const baseline = await repo.createBaseline(participant.id, {
    daysOfWeek: [...new Set(daysOfWeek as number[])].sort(), startTime, endTime, timezone, label,
  })
  await repo.logEvent('baseline_set', { participantId: participant.id })

  return Response.json({ ok: true, id: baseline.id })
}

// DELETE — remove one of the viewer's own baselines.
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const viewer = await getViewer()
  const gate = requireVerified(viewer)
  if (gate) return gate

  const deleted = await repo.deleteBaseline(id, viewer!.id)
  if (!deleted) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json({ ok: true })
}

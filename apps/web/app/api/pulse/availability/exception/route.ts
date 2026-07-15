import { getViewer, resolveOrCreateParticipant, requireVerified } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { CAPS } from '@/lib/pulse/copy'

// One-off corrections ("I'm free" / "I'm away") — a DURABLE act, gated on the verified tier.
// Passive by design: no notification code path exists in this file.

export const dynamic = 'force-dynamic'

// A correction may span multiple days (vacation) but not more than 60 — a guard against typos.
const MAX_RANGE_MS = 60 * 86_400_000

// GET — list the viewer's own current/upcoming exceptions.
export async function GET() {
  const viewer = await getViewer()
  const gate = requireVerified(viewer)
  if (gate) return gate
  const exceptions = await repo.exceptionsForParticipant(viewer!.id, new Date())
  return Response.json({
    exceptions: exceptions.map((e) => ({
      id: e.id, state: e.state, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(),
      allDay: e.allDay, label: e.label,
    })),
  })
}

// POST — record a correction.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const participant = await resolveOrCreateParticipant()
  const gate = requireVerified(participant)
  if (gate) return gate

  const state = body?.state
  if (state !== 'free' && state !== 'busy') return Response.json({ error: 'state must be free or busy' }, { status: 400 })

  const startsAt = typeof body?.startsAt === 'string' ? new Date(body.startsAt) : new Date(NaN)
  const endsAt = typeof body?.endsAt === 'string' ? new Date(body.endsAt) : new Date(NaN)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return Response.json({ error: 'startsAt/endsAt must be a valid range' }, { status: 400 })
  }
  if (endsAt.getTime() - startsAt.getTime() > MAX_RANGE_MS) {
    return Response.json({ error: 'range too long' }, { status: 400 })
  }

  const allDay = body?.allDay === true
  const label = typeof body?.label === 'string' && body.label.trim()
    ? body.label.trim().slice(0, CAPS.availabilityLabel) : null

  const exception = await repo.createException(participant.id, { state, startsAt, endsAt, allDay, label })
  await repo.logEvent('exception_set', { participantId: participant.id })

  return Response.json({ ok: true, id: exception.id })
}

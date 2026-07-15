import { resolveOrCreateParticipant, adoptParticipant, toPublicViewer } from '@/lib/pulse/identity'
import { issueVerification, confirmVerification } from '@/lib/pulse/phone'
import { clientIp } from '@/lib/pulse/ratelimit'

// POST /api/pulse/verify — send a 6-digit code to a phone (issue).
// The verify flow is reached lazily from a durable act; consumption paths never hit it.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.phone !== 'string') return Response.json({ error: 'phone required' }, { status: 400 })

  await resolveOrCreateParticipant() // ensure the device has an identity to verify into

  const result = await issueVerification(body.phone, clientIp(request))
  if (!result.ok) {
    if (result.error === 'throttled') {
      return Response.json({ error: 'too many codes — try again later' }, { status: 429, headers: { 'retry-after': '600' } })
    }
    return Response.json({ error: 'enter a real phone number' }, { status: 400 })
  }
  return Response.json({ ok: true })
}

// PUT /api/pulse/verify — confirm the code. On a ghost merge the device cookie is re-pointed
// to the canonical participant (new Set-Cookie); the ghost row is left orphaned.
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.phone !== 'string' || typeof body.code !== 'string') {
    return Response.json({ error: 'phone and code required' }, { status: 400 })
  }

  const participant = await resolveOrCreateParticipant()
  const result = await confirmVerification(participant.id, body.phone, body.code)
  if (!result.ok) {
    const message: Record<string, string> = {
      invalid_phone: 'enter a real phone number',
      no_code: 'request a code first',
      expired: 'that code expired — request a new one',
      too_many_attempts: 'too many tries — request a new code',
      bad_code: 'wrong code — try again',
    }
    const status = result.error === 'bad_code' ? 401 : 400
    return Response.json({ error: message[result.error], code: result.error }, { status })
  }

  if (result.merged) await adoptParticipant(result.participant)
  return Response.json({ ok: true, merged: result.merged, viewer: toPublicViewer(result.participant) })
}

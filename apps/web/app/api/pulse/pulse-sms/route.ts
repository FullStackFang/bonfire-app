import { resolveOrCreateParticipant, requireVerified } from '@/lib/pulse/identity'
import * as repo from '@/lib/pulse/repo'
import { pulseMessage } from '@/lib/pulse/copy'
import { deliverPulseSms, inQuietHours, quietHoursTimezone } from '@/lib/pulse/sms'

/** Absolute origin for share links: explicit env in dev/preview, request origin otherwise. */
function baseUrl(request: Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL
  return new URL(request.url).origin
}

// POST /api/pulse/pulse-sms — "Text the crew": the ONLY notifying path in the system.
// Requires: verified tier, the pulse is crew-scoped, the sender created it and is a member.
// Quiet hours block with an explicit reason (never silently queued). Dedupe lives in
// sms_deliveries — a retry skips already-claimed recipients.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })

  const pulse = await repo.getPulseByToken(typeof body?.pulseToken === 'string' ? body.pulseToken : '')
  if (!pulse) return Response.json({ error: 'pulse not found' }, { status: 404 })
  if (!pulse.crewId) return Response.json({ error: 'standalone pulses have no crew to text' }, { status: 400 })

  const participant = await resolveOrCreateParticipant()
  const gate = requireVerified(participant)
  if (gate) return gate

  if (pulse.createdBy !== participant.id) {
    return Response.json({ error: 'only the creator can text the crew' }, { status: 403 })
  }
  if (!(await repo.isCrewMember(pulse.crewId, participant.id))) {
    return Response.json({ error: 'join the crew before texting it' }, { status: 403 })
  }

  const browserTz = typeof body?.timezone === 'string' ? body.timezone : null
  if (inQuietHours(new Date(), await quietHoursTimezone(participant.id, browserTz))) {
    return Response.json(
      { error: 'quiet hours (10pm–8am) — copy the link into chat instead', code: 'quiet_hours' },
      { status: 409 },
    )
  }

  const url = `${baseUrl(request)}/p/s/${pulse.token}`
  const result = await deliverPulseSms(
    pulse.id, pulse.crewId, participant.id,
    pulseMessage(pulse.title, pulse.place, pulse.timeLabel, url),
  )
  if ('error' in result) {
    return Response.json(
      { error: 'sending too fast — give it a few minutes', code: result.error },
      { status: 429, headers: { 'retry-after': '600' } },
    )
  }
  return Response.json({ ok: true, ...result })
}

import { sql } from '../db'
import { deliverSmsWithSid } from '../sms'
import * as repo from './repo'

// Crew SMS fan-out — the ONLY notifying path in the entire pulse system. Synchronous and
// sequential (crews are single-digit small; no queue infrastructure). Each send claims an
// sms_deliveries row FIRST: the unique (pulse_id, recipient_participant_id) key is the dedupe
// guard, so a client retry skips already-claimed recipients and never double-texts.

// Rate limits: a creator may SMS-deliver at most 4 pulses per 10 minutes, and a crew may
// receive at most 8 SMS fan-outs per hour, regardless of who sends.
const SENDER_WINDOW_SEC = 600
const SENDER_LIMIT = 4
const CREW_WINDOW_SEC = 3600
const CREW_LIMIT = 8

export type QuietHours = { start: number; end: number }
export const QUIET_HOURS: QuietHours = { start: 22, end: 8 } // 22:00–08:00 local

/** Is `now` inside quiet hours in the given IANA timezone? */
export function inQuietHours(now: Date, timezone: string): boolean {
  let hour: number
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' })
        .format(now),
    )
  } catch {
    hour = now.getUTCHours() // unknown zone — fail toward blocking real people's sleep, not the app
  }
  return hour >= QUIET_HOURS.start || hour < QUIET_HOURS.end
}

/** The creator's quiet-hours timezone: their latest declared baseline's zone, falling back to
 *  the compose-time browser timezone the client sent (recipients have no zones in v1). */
export async function quietHoursTimezone(participantId: string, browserTz: string | null): Promise<string> {
  const baselines = await repo.baselinesForParticipant(participantId)
  const declared = baselines[baselines.length - 1]?.timezone
  return declared ?? browserTz ?? 'UTC'
}

export type SmsFanoutResult = {
  sent: number
  skipped: number // already delivered (retry) or no phone on file
  failed: number
}

export type SmsDeliveryError = 'throttled_sender' | 'throttled_crew'

/** Fan out one SMS per crew member, excluding the sender. Returns per-send tallies. */
export async function deliverPulseSms(
  pulseId: string, crewId: string, senderId: string, body: string,
): Promise<SmsFanoutResult | { error: SmsDeliveryError }> {
  await repo.logAction('participant', senderId, 'pulse_sms')
  await repo.logAction('crew', crewId, 'pulse_sms')
  const [bySender, byCrew] = await Promise.all([
    repo.countActions('participant', senderId, 'pulse_sms', SENDER_WINDOW_SEC),
    repo.countActions('crew', crewId, 'pulse_sms', CREW_WINDOW_SEC),
  ])
  if (bySender > SENDER_LIMIT) return { error: 'throttled_sender' }
  if (byCrew > CREW_LIMIT) return { error: 'throttled_crew' }

  const members = await repo.memberPhonesForCrew(crewId)
  const result: SmsFanoutResult = { sent: 0, skipped: 0, failed: 0 }

  for (const m of members) {
    if (m.participantId === senderId) continue // never text the creator
    if (!m.phone) { result.skipped++; continue } // roster row without a phone (shouldn't happen — join is gated)

    // Claim the delivery row first. A conflict means this recipient was already handled
    // (an earlier attempt or a concurrent retry) — skip, never double-text.
    const claimed = await sql()`
      insert into pulse.sms_deliveries (pulse_id, recipient_participant_id, status)
      values (${pulseId}, ${m.participantId}, ${process.env.SMS_DRY_RUN === '1' ? 'dry_run' : 'sent'})
      on conflict (pulse_id, recipient_participant_id) do nothing
      returning id`
    if (claimed.length === 0) { result.skipped++; continue }

    try {
      const sid = await deliverSmsWithSid(m.phone, body)
      if (sid) {
        await sql()`update pulse.sms_deliveries set twilio_sid = ${sid} where id = ${claimed[0].id}`
      }
      result.sent++
    } catch {
      await sql()`update pulse.sms_deliveries set status = 'failed' where id = ${claimed[0].id}`
      result.failed++
    }
  }

  await repo.logEvent('sms_sent', { pulseId, crewId, participantId: senderId })
  return result
}

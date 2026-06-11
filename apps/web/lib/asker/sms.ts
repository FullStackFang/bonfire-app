import type { Member, SmsKind } from './types'
import { NON_EVENT_KINDS } from './types'
import { nyDayStartUtc } from './time'

export type SmsDeps = {
  /** Atomically claim the (member, kind, context) send slot. True = we own delivery.
   *  Re-claimable when a prior attempt failed or a claim went stale (crashed mid-send). */
  claim(memberId: string, kind: SmsKind, contextId: string, body: string): Promise<boolean>
  markSent(memberId: string, kind: SmsKind, contextId: string): Promise<void>
  markFailed(memberId: string, kind: SmsKind, contextId: string): Promise<void>
  /** count of non-failed NON_EVENT_KINDS rows for member since the given instant */
  nonEventCountSince(memberId: string, since: Date): Promise<number>
  deliver(phone: string, body: string): Promise<void>
}

export type SendArgs = { member: Member; kind: SmsKind; contextId: string; body: string; now: Date }
export type SendResult = 'sent' | 'deduped' | 'budget_suppressed' | 'delivery_failed'

const DAILY_NON_EVENT_CAP = 1

/** Claim-first send: the sms_log unique key is the distributed mutex, so concurrent
 *  callers (overlapping ticks, parallel route handlers) can never double-deliver. */
export async function sendSms(deps: SmsDeps, a: SendArgs): Promise<SendResult> {
  if (NON_EVENT_KINDS.includes(a.kind)) {
    const used = await deps.nonEventCountSince(a.member.id, nyDayStartUtc(a.now))
    if (used >= DAILY_NON_EVENT_CAP) return 'budget_suppressed'
  }
  if (!(await deps.claim(a.member.id, a.kind, a.contextId, a.body))) return 'deduped'
  try {
    await deps.deliver(a.member.phone, a.body)
  } catch {
    await deps.markFailed(a.member.id, a.kind, a.contextId).catch(() => {})
    return 'delivery_failed'
  }
  await deps.markSent(a.member.id, a.kind, a.contextId).catch(() => {})
  return 'sent'
}

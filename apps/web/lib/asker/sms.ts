import type { Member, SmsKind } from './types'
import { NON_EVENT_KINDS } from './types'
import { nyDayStartUtc } from './time'

export type SmsDeps = {
  alreadySent(memberId: string, kind: SmsKind, contextId: string): Promise<boolean>
  /** count of NON_EVENT_KINDS rows for member since the given instant */
  nonEventCountSince(memberId: string, since: Date): Promise<number>
  log(memberId: string, kind: SmsKind, contextId: string, body: string): Promise<void>
  deliver(phone: string, body: string): Promise<void>
}

export type SendArgs = { member: Member; kind: SmsKind; contextId: string; body: string; now: Date }
export type SendResult = 'sent' | 'deduped' | 'budget_suppressed' | 'delivery_failed'

const DAILY_NON_EVENT_CAP = 1

export async function sendSms(deps: SmsDeps, a: SendArgs): Promise<SendResult> {
  if (await deps.alreadySent(a.member.id, a.kind, a.contextId)) return 'deduped'
  if (NON_EVENT_KINDS.includes(a.kind)) {
    const used = await deps.nonEventCountSince(a.member.id, nyDayStartUtc(a.now))
    if (used >= DAILY_NON_EVENT_CAP) return 'budget_suppressed'
  }
  try {
    await deps.deliver(a.member.phone, a.body)
  } catch {
    await deps.log(a.member.id, a.kind, a.contextId, `[FAILED] ${a.body}`)
    return 'delivery_failed'
  }
  await deps.log(a.member.id, a.kind, a.contextId, a.body)
  return 'sent'
}

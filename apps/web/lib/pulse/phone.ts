import { createHash, randomInt } from 'node:crypto'
import { deliverSms } from '../sms'
import { normalizePhone } from './phone-format'
import * as repo from './repo'
import type { Participant } from './types'

// The pure helpers live in phone-format.ts (client-safe, no node imports); re-exported here
// so existing server imports and tests are untouched.
export { normalizePhone, maskPhone } from './phone-format'

// One-time SMS phone verification for the durable (tier-1) identity. Codes are 6 digits,
// hashed at rest, expire in 10 minutes, allow 5 attempts, single-use. Issuing is rate-limited
// per phone and per IP through pulse.action_log (same mechanism as create/mutate limits).

export const CODE_TTL_MS = 10 * 60 * 1000
export const MAX_ATTEMPTS = 5
// Conservative: 3 codes per phone and 8 per IP in a 10-minute rolling window.
const ISSUE_WINDOW_SEC = 600
const ISSUE_LIMIT_PHONE = 3
const ISSUE_LIMIT_IP = 8

export type IssueResult = { ok: true } | { ok: false; error: 'invalid_phone' | 'throttled' }
export type ConfirmResult =
  | { ok: true; participant: Participant; merged: boolean }
  | { ok: false; error: 'invalid_phone' | 'no_code' | 'expired' | 'too_many_attempts' | 'bad_code' }

export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

// --- Guest-code bridge (TEMPORARY: remove once Twilio SMS delivery is live) ------------------
// While real SMS isn't wired up, an allowlisted tester number can verify by typing a shared
// 6-digit guest code instead of a texted one. Off unless BOTH env vars are set:
//   GUEST_VERIFY_CODE=424242            the shared code (6 digits — the code input is numeric-only)
//   GUEST_VERIFY_PHONES=+16462268158,…  comma-separated allowlist of tester numbers
// The allowlist is the security boundary: only these trusted numbers can bypass, so the normal
// ghost-merge behavior downstream stays safe. Unset either var to disable the bridge entirely.
function guestAllowlist(): Set<string> {
  return new Set(
    (process.env.GUEST_VERIFY_PHONES ?? '')
      .split(',')
      .map((s) => normalizePhone(s))
      .filter((p): p is string => Boolean(p)),
  )
}

/** Does this (already-normalized) phone + submitted code satisfy the guest bridge? The
 *  allowlist is the security boundary: exported so its decision logic is unit-tested directly. */
export function isGuestBypass(phone: string, code: string): boolean {
  const guestCode = process.env.GUEST_VERIFY_CODE
  if (!guestCode) return false
  if (code.trim() !== guestCode.trim()) return false
  return guestAllowlist().has(phone)
}

/** Adopt or create the durable identity for a freshly-verified phone. Shared by the real SMS
 *  path and the guest-code bridge so merge/create behavior never diverges between them. */
async function finalizeVerification(participantId: string, phone: string): Promise<ConfirmResult> {
  const canonical = await repo.getParticipantByPhone(phone)
  if (canonical && canonical.id !== participantId) {
    // Ghost merge: the phone already has a canonical identity — the device adopts it.
    await repo.logEvent('phone_verified', { participantId: canonical.id })
    return { ok: true, participant: canonical, merged: true }
  }
  const participant = canonical ?? (await repo.setPhoneVerified(participantId, phone))
  await repo.logEvent('phone_verified', { participantId: participant.id })
  return { ok: true, participant, merged: false }
}

/** Send a 6-digit code to the phone. Rate-limited per phone and per IP. */
export async function issueVerification(phoneInput: string, ip: string): Promise<IssueResult> {
  const phone = normalizePhone(phoneInput)
  if (!phone) return { ok: false, error: 'invalid_phone' }

  // Count-then-log ordering doesn't matter at these limits; log first so bursts race safely.
  await repo.logAction('phone', phone, 'verify_issue')
  await repo.logAction('ip', ip, 'verify_issue')
  const [byPhone, byIp] = await Promise.all([
    repo.countActions('phone', phone, 'verify_issue', ISSUE_WINDOW_SEC),
    repo.countActions('ip', ip, 'verify_issue', ISSUE_WINDOW_SEC),
  ])
  if (byPhone > ISSUE_LIMIT_PHONE || byIp > ISSUE_LIMIT_IP) return { ok: false, error: 'throttled' }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await repo.createVerification(phone, hashCode(code), new Date(Date.now() + CODE_TTL_MS))
  await deliverSms(phone, `Your Bonfire code is ${code}. It expires in 10 minutes.`)
  return { ok: true }
}

/** Confirm a code for the acting participant. On success, either the participant gains the
 *  phone (first verify) or — if the phone already belongs to a canonical row — that canonical
 *  participant is returned with merged=true and the caller re-points the device cookie to it.
 *  The ghost row's tier-0 activity is not migrated (ephemeral by design). */
export async function confirmVerification(
  participantId: string, phoneInput: string, code: string,
): Promise<ConfirmResult> {
  const phone = normalizePhone(phoneInput)
  if (!phone) return { ok: false, error: 'invalid_phone' }

  // Guest-code bridge: an allowlisted number + the shared code skips the SMS round-trip.
  if (isGuestBypass(phone, code)) return finalizeVerification(participantId, phone)

  const v = await repo.latestVerification(phone)
  if (!v) return { ok: false, error: 'no_code' }
  if (v.expiresAt.getTime() <= Date.now()) return { ok: false, error: 'expired' }
  if (v.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'too_many_attempts' }

  if (hashCode(code.trim()) !== v.codeHash) {
    const attempts = await repo.bumpVerificationAttempts(v.id)
    return { ok: false, error: attempts >= MAX_ATTEMPTS ? 'too_many_attempts' : 'bad_code' }
  }

  await repo.consumeVerification(v.id) // single-use, even for a merge
  return finalizeVerification(participantId, phone)
}

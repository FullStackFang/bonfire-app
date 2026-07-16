import { describe, it, expect, beforeAll } from 'vitest'

// normalizePhone + requireVerified are pure — always run. The OTP round-trip needs real rows
// and is DB-gated like repo.test.ts (set TEST_DATABASE_URL; SMS_DRY_RUN keeps Twilio out).
const url = process.env.TEST_DATABASE_URL

describe('normalizePhone', () => {
  it('accepts E.164 and strips formatting', async () => {
    const { normalizePhone } = await import('./phone')
    expect(normalizePhone('+1 (555) 010-2030')).toBe('+15550102030')
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958')
  })
  it('assumes US for bare 10-digit numbers', async () => {
    const { normalizePhone } = await import('./phone')
    expect(normalizePhone('555-010-2030')).toBe('+15550102030')
    expect(normalizePhone('15550102030')).toBe('+15550102030')
  })
  it('rejects garbage', async () => {
    const { normalizePhone } = await import('./phone')
    expect(normalizePhone('hello')).toBeNull()
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('+0123456789')).toBeNull()
  })
})

describe('formatPhoneDisplay', () => {
  it('formats NANP numbers for display', async () => {
    const { formatPhoneDisplay } = await import('./phone-format')
    expect(formatPhoneDisplay('6462268158')).toBe('+1 646-226-8158')
    expect(formatPhoneDisplay('(646) 226-8158')).toBe('+1 646-226-8158')
    expect(formatPhoneDisplay('+16462268158')).toBe('+1 646-226-8158')
  })
  it('leaves non-NANP numbers bare E.164', async () => {
    const { formatPhoneDisplay } = await import('./phone-format')
    expect(formatPhoneDisplay('+44 20 7946 0958')).toBe('+442079460958')
  })
  it('falls back to the raw (trimmed) input when unparseable', async () => {
    const { formatPhoneDisplay } = await import('./phone-format')
    expect(formatPhoneDisplay(' 12345 ')).toBe('12345')
    expect(formatPhoneDisplay('hello')).toBe('hello')
  })
})

describe('requireVerified gating matrix', () => {
  const tier0 = {
    id: 'p0', token: 't0', displayName: 'Ghost', phone: null, phoneVerifiedAt: null, createdAt: new Date(),
  }
  const tier1 = { ...tier0, id: 'p1', phone: '+15550102030', phoneVerifiedAt: new Date() }

  it('blocks tier-0 with a verify_required 403', async () => {
    const { requireVerified } = await import('./identity')
    const res = requireVerified(tier0)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
    const body = await res!.json()
    expect(body.code).toBe('verify_required')
  })
  it('passes tier-1 (and never gates on display name)', async () => {
    const { requireVerified } = await import('./identity')
    expect(requireVerified(tier1)).toBeNull()
    expect(requireVerified({ ...tier1, displayName: null })).toBeNull()
  })
  it('blocks a missing participant', async () => {
    const { requireVerified } = await import('./identity')
    expect(requireVerified(null)).not.toBeNull()
  })
})

describe.skipIf(!url)('phone verification (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
    process.env.SMS_DRY_RUN = '1'
  })

  // Distinct per-test phones so tests never share verification rows or rate-limit windows.
  // Unique across runs too — the local dev DB persists rows between test runs.
  let seq = Date.now() % 10_000_000
  const freshPhone = () => `+1212${String(seq++).padStart(7, '0').slice(-7)}`

  async function fixtures() {
    const repo = await import('./repo')
    const phone = await import('./phone')
    const { newToken } = await import('../ids')
    const participant = await repo.createParticipant(newToken())
    return { repo, phone, newToken, participant }
  }

  it('code round-trip: issue → confirm sets phone + phone_verified_at and consumes the row', async () => {
    const { repo, phone, participant } = await fixtures()
    const p = freshPhone()
    const issued = await phone.issueVerification(p, '203.0.113.10')
    expect(issued).toEqual({ ok: true })

    // The code is hashed at rest; recover it for the test by writing a known one.
    const v = await repo.latestVerification(p)
    expect(v).not.toBeNull()
    await repo.consumeVerification(v!.id)
    await repo.createVerification(p, phone.hashCode('123456'), new Date(Date.now() + 60_000))

    const confirmed = await phone.confirmVerification(participant.id, p, '123456')
    expect(confirmed.ok).toBe(true)
    if (confirmed.ok) {
      expect(confirmed.merged).toBe(false)
      expect(confirmed.participant.phone).toBe(p)
      expect(confirmed.participant.phoneVerifiedAt).not.toBeNull()
    }
  })

  it('expired codes are rejected', async () => {
    const { repo, phone, participant } = await fixtures()
    const p = freshPhone()
    await repo.createVerification(p, phone.hashCode('123456'), new Date(Date.now() - 1_000))
    const res = await phone.confirmVerification(participant.id, p, '123456')
    expect(res).toEqual({ ok: false, error: 'expired' })
  })

  it('attempt cap: 5 wrong tries exhaust the code, right code no longer works', async () => {
    const { repo, phone, participant } = await fixtures()
    const p = freshPhone()
    await repo.createVerification(p, phone.hashCode('123456'), new Date(Date.now() + 60_000))
    for (let i = 0; i < 4; i++) {
      const res = await phone.confirmVerification(participant.id, p, '000000')
      expect(res).toEqual({ ok: false, error: 'bad_code' })
    }
    const fifth = await phone.confirmVerification(participant.id, p, '000000')
    expect(fifth).toEqual({ ok: false, error: 'too_many_attempts' })
    const after = await phone.confirmVerification(participant.id, p, '123456')
    expect(after).toEqual({ ok: false, error: 'too_many_attempts' })
  })

  it('codes are single-use', async () => {
    const { repo, phone, participant, newToken } = await fixtures()
    const p = freshPhone()
    await repo.createVerification(p, phone.hashCode('123456'), new Date(Date.now() + 60_000))
    const first = await phone.confirmVerification(participant.id, p, '123456')
    expect(first.ok).toBe(true)
    const second = await repo.createParticipant(newToken())
    const replay = await phone.confirmVerification(second.id, p, '123456')
    expect(replay).toEqual({ ok: false, error: 'no_code' })
  })

  it('issuing is rate-limited per phone', async () => {
    const { phone } = await fixtures()
    const p = freshPhone()
    for (let i = 0; i < 3; i++) {
      expect(await phone.issueVerification(p, `198.51.100.${i}`)).toEqual({ ok: true })
    }
    expect(await phone.issueVerification(p, '198.51.100.99')).toEqual({ ok: false, error: 'throttled' })
  })

  it('issuing is rate-limited per IP across phones', async () => {
    const { phone } = await fixtures()
    const ip = `test-ip-${seq++}` // scope_key is opaque text — unique per run
    for (let i = 0; i < 8; i++) {
      expect(await phone.issueVerification(freshPhone(), ip)).toEqual({ ok: true })
    }
    expect(await phone.issueVerification(freshPhone(), ip)).toEqual({ ok: false, error: 'throttled' })
  })

  it('ghost merge: verifying an existing phone returns the canonical participant', async () => {
    const { repo, phone, participant: canonicalDevice, newToken } = await fixtures()
    const p = freshPhone()
    await repo.createVerification(p, phone.hashCode('111111'), new Date(Date.now() + 60_000))
    const first = await phone.confirmVerification(canonicalDevice.id, p, '111111')
    expect(first.ok).toBe(true)

    const ghost = await repo.createParticipant(newToken())
    await repo.createVerification(p, phone.hashCode('222222'), new Date(Date.now() + 60_000))
    const merged = await phone.confirmVerification(ghost.id, p, '222222')
    expect(merged.ok).toBe(true)
    if (merged.ok) {
      expect(merged.merged).toBe(true)
      expect(merged.participant.id).toBe(canonicalDevice.id) // canonical, not the ghost
    }
    // The ghost row is untouched — orphaned, never given the phone.
    const ghostAfter = await repo.getParticipantByToken(ghost.token)
    expect(ghostAfter!.phone).toBeNull()
  })
})

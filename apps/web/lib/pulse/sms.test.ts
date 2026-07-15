import { describe, it, expect, beforeAll } from 'vitest'
import { inQuietHours } from './sms'

// Quiet hours are pure — always run. The fan-out/dedupe/throttle paths need real rows and are
// DB-gated like repo.test.ts. SMS_DRY_RUN keeps Twilio out entirely.
const url = process.env.TEST_DATABASE_URL

describe('inQuietHours', () => {
  it('blocks 22:00–08:00 local and allows the day', () => {
    // 2026-07-16T03:30Z = 23:30 Jul 15 in New York (EDT) — quiet
    expect(inQuietHours(new Date('2026-07-16T03:30:00Z'), 'America/New_York')).toBe(true)
    // 12:00 local — fine
    expect(inQuietHours(new Date('2026-07-16T16:00:00Z'), 'America/New_York')).toBe(false)
    // 07:59 local — still quiet
    expect(inQuietHours(new Date('2026-07-16T11:59:00Z'), 'America/New_York')).toBe(true)
    // 08:00 local — open
    expect(inQuietHours(new Date('2026-07-16T12:00:00Z'), 'America/New_York')).toBe(false)
    // same instant, different zone: 12:30 in Warsaw (CEST) — fine
    expect(inQuietHours(new Date('2026-07-16T10:30:00Z'), 'Europe/Warsaw')).toBe(false)
  })
})

describe.skipIf(!url)('deliverPulseSms (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
    process.env.SMS_DRY_RUN = '1'
  })

  // Unique across runs too — the local dev DB persists rows between test runs.
  let seq = Date.now() % 10_000_000
  const freshPhone = () => `+1929${String(seq++).padStart(7, '0').slice(-7)}`

  async function crewOf(n: number) {
    const repo = await import('./repo')
    const sms = await import('./sms')
    const { newToken } = await import('../ids')
    const creator = await repo.createParticipant(newToken())
    await repo.setPhoneVerified(creator.id, freshPhone())
    const crew = await repo.createCrew(newToken(), 'SMS Crew', creator.id)
    await repo.addCrewMember(crew.id, creator.id)
    const members = []
    for (let i = 0; i < n; i++) {
      const m = await repo.createParticipant(newToken())
      await repo.setPhoneVerified(m.id, freshPhone())
      await repo.addCrewMember(crew.id, m.id)
      members.push(m)
    }
    const pulse = await repo.createPulse({
      token: newToken(), crewId: crew.id, title: 'Pickup', place: 'Park', timeLabel: '6pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    return { repo, sms, creator, crew, members, pulse }
  }

  it('fan-out texts each member once and never the creator', async () => {
    const { sms, creator, crew, pulse } = await crewOf(3)
    const result = await sms.deliverPulseSms(pulse.id, crew.id, creator.id, 'test body')
    expect(result).toEqual({ sent: 3, skipped: 0, failed: 0 })

    const { sql } = await import('../db')
    const rows = await sql()`
      select recipient_participant_id from pulse.sms_deliveries where pulse_id = ${pulse.id}`
    expect(rows).toHaveLength(3)
    const recipients = (rows as unknown as { recipientParticipantId: string }[]).map((r) => r.recipientParticipantId)
    expect(recipients).not.toContain(creator.id)
  })

  it('retry never double-texts: the second run skips every claimed recipient', async () => {
    const { sms, creator, crew, pulse } = await crewOf(2)
    const first = await sms.deliverPulseSms(pulse.id, crew.id, creator.id, 'test body')
    expect(first).toEqual({ sent: 2, skipped: 0, failed: 0 })
    const retry = await sms.deliverPulseSms(pulse.id, crew.id, creator.id, 'test body')
    expect(retry).toEqual({ sent: 0, skipped: 2, failed: 0 })

    const { sql } = await import('../db')
    const [row] = await sql()`
      select count(*)::int n from pulse.sms_deliveries where pulse_id = ${pulse.id}`
    expect(row.n).toBe(2) // still one row per recipient
  })

  it('sender throttle: a 5th fan-out inside the window is rejected', async () => {
    const { repo, sms, creator, crew } = await crewOf(1)
    const { newToken } = await import('../ids')
    for (let i = 0; i < 4; i++) {
      const p = await repo.createPulse({
        token: newToken(), crewId: crew.id, title: `p${i}`, place: 'x', timeLabel: 'now',
        expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
      })
      const r = await sms.deliverPulseSms(p.id, crew.id, creator.id, 'b')
      expect('error' in r).toBe(false)
    }
    const fifth = await repo.createPulse({
      token: newToken(), crewId: crew.id, title: 'p5', place: 'x', timeLabel: 'now',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    const r = await sms.deliverPulseSms(fifth.id, crew.id, creator.id, 'b')
    expect(r).toEqual({ error: 'throttled_sender' })

    const { sql } = await import('../db')
    const [row] = await sql()`
      select count(*)::int n from pulse.sms_deliveries where pulse_id = ${fifth.id}`
    expect(row.n).toBe(0) // a throttled call writes nothing
  })

  it('members without a phone are skipped, not crashed on', async () => {
    const { repo, sms, creator, crew, pulse } = await crewOf(1)
    const { newToken } = await import('../ids')
    const ghost = await repo.createParticipant(newToken()) // roster row with no phone
    await repo.addCrewMember(crew.id, ghost.id)
    const result = await sms.deliverPulseSms(pulse.id, crew.id, creator.id, 'b')
    expect(result).toEqual({ sent: 1, skipped: 1, failed: 0 })
  })
})

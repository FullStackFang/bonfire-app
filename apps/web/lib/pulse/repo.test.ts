import { describe, it, expect, beforeAll } from 'vitest'

// DB-gated, mirroring lib/asker/repo.integration.test.ts: runs only when TEST_DATABASE_URL is set
// (apply supabase/migrations first). Covers the idempotency + liveness paths that need real SQL.
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('pulse repo (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
  })

  async function fixtures() {
    const repo = await import('./repo')
    const { newToken } = await import('../ids')
    const creator = await repo.createParticipant(newToken())
    await repo.setDisplayName(creator.id, 'Creator')
    return { repo, newToken, creator }
  }

  it('double pulse-create with one client_uuid yields exactly one row', async () => {
    const { repo, newToken, creator } = await fixtures()
    const crew = await repo.createCrew(newToken(), 'Greece', creator.id)
    const clientUuid = crypto.randomUUID()
    const base = {
      crewId: crew.id, title: 'Sunset', place: 'Oia', timeLabel: '8:30pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid,
    }
    const a = await repo.createPulse({ ...base, token: newToken() })
    const b = await repo.createPulse({ ...base, token: newToken() })
    expect(a.id).toBe(b.id)
    const active = await repo.activePulsesForCrew(crew.id, new Date())
    expect(active.filter((p) => p.clientUuid === clientUuid)).toHaveLength(1)
  })

  it('a pulse created without geocode args defaults to unresolved, null coordinates', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await repo.createPulse({
      token: newToken(), crewId: null, title: 'No geo', place: 'my place', timeLabel: '8pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    expect(pulse.placeGeoStatus).toBe('unresolved')
    expect(pulse.placeLat).toBeNull()
    expect(pulse.placeLng).toBeNull()
    // Round-trips through a fresh read (columns persisted, not just echoed).
    const read = await repo.getPulseByToken(pulse.token)
    expect(read!.placeGeoStatus).toBe('unresolved')
  })

  it('a resolved geocode persists coordinates + status and reads back', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Mapped', place: 'The Anchor, Rivington', timeLabel: '9pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
      placeLat: 40.7189, placeLng: -73.9877, placeGeoStatus: 'resolved',
    })
    expect(pulse.placeGeoStatus).toBe('resolved')
    const read = await repo.getPulseByToken(pulse.token)
    expect(read!.placeLat).toBeCloseTo(40.7189, 4)
    expect(read!.placeLng).toBeCloseTo(-73.9877, 4)
    expect(read!.placeGeoStatus).toBe('resolved')
  })

  it('setPulseGeo applies an async geocode result and bumps version for pollers', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Async geo', place: 'Fort Greene Park', timeLabel: '7pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    expect(pulse.placeGeoStatus).toBe('unresolved')
    await repo.setPulseGeo(pulse.id, 40.6913, -73.9742, 'resolved')
    const read = await repo.getPulseByToken(pulse.token)
    expect(read!.placeGeoStatus).toBe('resolved')
    expect(read!.placeLat).toBeCloseTo(40.6913, 4)
    expect(read!.placeLng).toBeCloseTo(-73.9742, 4)
    // The version bump is what carries the map to polling viewers (ETag changes).
    expect(Number(read!.version)).toBe(Number(pulse.version) + 1)
  })

  it('standalone double pulse-create also dedupes (NULLS NOT DISTINCT)', async () => {
    const { repo, newToken, creator } = await fixtures()
    const clientUuid = crypto.randomUUID()
    const base = {
      crewId: null, title: 'Pickup', place: 'Smithfield', timeLabel: '5pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid,
    }
    const a = await repo.createPulse({ ...base, token: newToken() })
    const b = await repo.createPulse({ ...base, token: newToken() })
    expect(a.id).toBe(b.id)
  })

  it('an expired pulse is excluded from the active read', async () => {
    const { repo, newToken, creator } = await fixtures()
    const crew = await repo.createCrew(newToken(), 'Expiry', creator.id)
    await repo.createPulse({
      token: newToken(), crewId: crew.id, title: 'Past', place: 'Nowhere',
      timeLabel: 'yesterday', expiresAt: new Date(Date.now() - 3_600_000),
      createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    const active = await repo.activePulsesForCrew(crew.id, new Date())
    expect(active).toHaveLength(0)
  })

  it('a wrapped pulse is excluded from the active read', async () => {
    const { repo, newToken, creator } = await fixtures()
    const crew = await repo.createCrew(newToken(), 'Wrap', creator.id)
    const pulse = await repo.createPulse({
      token: newToken(), crewId: crew.id, title: 'Live', place: 'Bar',
      timeLabel: 'now', expiresAt: new Date(Date.now() + 3_600_000),
      createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    await repo.closePulse(pulse)
    const active = await repo.activePulsesForCrew(crew.id, new Date())
    expect(active).toHaveLength(0)
  })

  it('upsert response is idempotent — two upserts keep one row, second wins', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Solo', place: 'Park', timeLabel: '6pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    await repo.upsertResponse(pulse, creator.id, 'on_my_way', 10, null)
    await repo.upsertResponse(pulse, creator.id, 'here', null, 'got a table')
    const rows = await repo.responsesForPulse(pulse.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('here')
    expect(rows[0].note).toBe('got a table')
  })

  it('upsert presence is idempotent per (crew, participant)', async () => {
    const { repo, newToken, creator } = await fixtures()
    const crew = await repo.createCrew(newToken(), 'Board', creator.id)
    await repo.upsertPresence(crew.id, creator.id, 'around', null)
    await repo.upsertPresence(crew.id, creator.id, 'busy', 'heads down')
    const rows = await repo.presenceForCrew(crew.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('busy')
    expect(rows[0].note).toBe('heads down')
  })

  // ---- dashboard reads ----

  it('dash pulses: a pulse I created but never responded to is included, live', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Creator only', place: 'Court', timeLabel: '7pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    const { live, earlier } = await repo.pulsesForParticipant(creator.id, new Date(), 10)
    const mine = live.find((p) => p.token === pulse.token)
    expect(mine).toBeDefined()
    expect(mine!.createdByMe).toBe(true)
    expect(mine!.myStatus).toBeNull()
    expect(earlier.find((p) => p.token === pulse.token)).toBeUndefined()
  })

  it('dash pulses: a wrap moves the pulse from live to earlier', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Wrappable', place: 'Bar', timeLabel: 'now',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    const before = await repo.pulsesForParticipant(creator.id, new Date(), 10)
    expect(before.live.some((p) => p.token === pulse.token)).toBe(true)
    await repo.closePulse(pulse)
    const after = await repo.pulsesForParticipant(creator.id, new Date(), 10)
    expect(after.live.some((p) => p.token === pulse.token)).toBe(false)
    expect(after.earlier.some((p) => p.token === pulse.token)).toBe(true)
  })

  it('dash pulses: an expired pulse I responded to lands in earlier with my status', async () => {
    const { repo, newToken, creator } = await fixtures()
    const responder = await repo.createParticipant(newToken())
    const pulse = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Expired', place: 'Park', timeLabel: 'earlier',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    await repo.upsertResponse(pulse, responder.id, 'in', null, null)
    const expired = new Date(Date.now() + 7_200_000) // "now" past the expiry
    const { live, earlier } = await repo.pulsesForParticipant(responder.id, expired, 10)
    expect(live).toHaveLength(0)
    const mine = earlier.find((p) => p.token === pulse.token)
    expect(mine).toBeDefined()
    expect(mine!.myStatus).toBe('in')
    expect(mine!.createdByMe).toBe(false)
  })

  it('dash pulses: earlier is capped in SQL, most recently ended first', async () => {
    const { repo, newToken, creator } = await fixtures()
    const mkEnded = (i: number) => repo.createPulse({
      token: newToken(), crewId: null, title: `Ended ${i}`, place: 'Spot', timeLabel: 'earlier',
      // Staggered expiries all in the past relative to the read's `now` below.
      expiresAt: new Date(Date.now() + i * 60_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    for (let i = 1; i <= 4; i++) await mkEnded(i)
    const now = new Date(Date.now() + 3_600_000) // past every expiry
    const { earlier } = await repo.pulsesForParticipant(creator.id, now, 2)
    expect(earlier).toHaveLength(2)
    // Most recently ended first: the i=4 expiry, then i=3.
    expect(earlier[0].title).toBe('Ended 4')
    expect(earlier[1].title).toBe('Ended 3')
  })

  it('dash crews: presence-only participation is included, with my status', async () => {
    const { repo, newToken, creator } = await fixtures()
    const tapper = await repo.createParticipant(newToken())
    const crew = await repo.createCrew(newToken(), 'Presence only', creator.id)
    await repo.upsertPresence(crew.id, tapper.id, 'around', 'by the harbor')
    const crews = await repo.crewsForParticipant(tapper.id)
    expect(crews).toHaveLength(1)
    expect(crews[0].token).toBe(crew.token)
    expect(crews[0].myStatus).toBe('around')
    expect(crews[0].myNote).toBe('by the harbor')
  })

  it('dash crews: an archived crew is excluded', async () => {
    const { repo, newToken, creator } = await fixtures()
    const { sql } = await import('../db')
    const crew = await repo.createCrew(newToken(), 'Archived', creator.id)
    await repo.addCrewMember(crew.id, creator.id)
    await sql()`update pulse.crews set archived_at = now() where id = ${crew.id}`
    const crews = await repo.crewsForParticipant(creator.id)
    expect(crews.find((c) => c.token === crew.token)).toBeUndefined()
  })

  // ---- ghost-merge footprint reassignment ----

  it('reassignPulseFootprint moves a created pulse onto the canonical participant', async () => {
    const { repo, newToken, creator: canonical } = await fixtures()
    const ghost = await repo.createParticipant(newToken())
    const pulse = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Anon drop', place: 'Park', timeLabel: '7pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: ghost.id, clientUuid: crypto.randomUUID(),
    })
    await repo.reassignPulseFootprint(ghost.id, canonical.id)
    const read = await repo.getPulseByToken(pulse.token)
    expect(read!.createdBy).toBe(canonical.id)
    // It now appears on the canonical's dashboard, and never on the ghost's.
    const mine = await repo.pulsesForParticipant(canonical.id, new Date(), 10)
    expect(mine.live.some((p) => p.token === pulse.token)).toBe(true)
    const ghosts = await repo.pulsesForParticipant(ghost.id, new Date(), 10)
    expect([...ghosts.live, ...ghosts.earlier].some((p) => p.token === pulse.token)).toBe(false)
  })

  it('reassignPulseFootprint moves a response with no conflict', async () => {
    const { repo, newToken, creator } = await fixtures()
    const ghost = await repo.createParticipant(newToken())
    const canonical = await repo.createParticipant(newToken())
    const pulse = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Joinable', place: 'Bar', timeLabel: '9pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    await repo.upsertResponse(pulse, ghost.id, 'here', null, 'got a table')
    await repo.reassignPulseFootprint(ghost.id, canonical.id)
    const rows = await repo.responsesForPulse(pulse.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].participantId).toBe(canonical.id)
    expect(rows[0].status).toBe('here')
    expect(rows[0].note).toBe('got a table')
  })

  it('reassignPulseFootprint resolves a response conflict to one row, keeping the canonical', async () => {
    const { repo, newToken, creator } = await fixtures()
    const ghost = await repo.createParticipant(newToken())
    const canonical = await repo.createParticipant(newToken())
    const pulse = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Both responded', place: 'Court', timeLabel: '6pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    // Both identities responded to the SAME pulse — a blind participant_id update would collide.
    await repo.upsertResponse(pulse, ghost.id, 'on_my_way', 10, 'ghost note')
    await repo.upsertResponse(pulse, canonical.id, 'in', null, 'canonical note')
    await repo.reassignPulseFootprint(ghost.id, canonical.id)
    const rows = await repo.responsesForPulse(pulse.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].participantId).toBe(canonical.id)
    expect(rows[0].status).toBe('in')       // the canonical's response is kept
    expect(rows[0].note).toBe('canonical note')
  })

  it("dash reads never return another participant's rows", async () => {
    const { repo, newToken, creator } = await fixtures()
    const bystander = await repo.createParticipant(newToken())
    const crew = await repo.createCrew(newToken(), 'Private', creator.id)
    await repo.addCrewMember(crew.id, creator.id)
    await repo.upsertPresence(crew.id, creator.id, 'around', null)
    const pulse = await repo.createPulse({
      token: newToken(), crewId: crew.id, title: 'Not yours', place: 'Bar', timeLabel: '9pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    await repo.upsertResponse(pulse, creator.id, 'in', null, null)
    const crews = await repo.crewsForParticipant(bystander.id)
    const { live, earlier } = await repo.pulsesForParticipant(bystander.id, new Date(), 10)
    expect(crews.find((c) => c.token === crew.token)).toBeUndefined()
    expect([...live, ...earlier].find((p) => p.token === pulse.token)).toBeUndefined()
  })
})

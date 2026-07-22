import { describe, it, expect, beforeAll } from 'vitest'

// DB-gated, mirroring lib/asker/repo.integration.test.ts: runs only when TEST_DATABASE_URL is set
// (apply supabase/migrations first). Covers the idempotency + liveness paths that need real SQL.
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('pulse repo (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    // Local PGlite (scripts/local-db.mjs) is ONE serial backend — run there with TEST_PG_POOL_MAX=1.
    process.env.PG_POOL_MAX = process.env.TEST_PG_POOL_MAX ?? '4'
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

  it('persists an explicit start_at + timezone, and a null start_at reads back as created_at', async () => {
    const { repo, newToken, creator } = await fixtures()
    const start = new Date(Date.now() + 2 * 3_600_000)
    const withStart = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Later', place: 'Bar', timeLabel: 'Tomorrow 9pm · ~2h',
      startAt: start, timezone: 'America/New_York', expiresAt: new Date(start.getTime() + 2 * 3_600_000),
      createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    const readStart = await repo.getPulseByToken(withStart.token)
    expect(readStart!.startAt.getTime()).toBe(start.getTime())
    expect(readStart!.timezone).toBe('America/New_York')

    // Omitting startAt (legacy path) stores null; the read coalesces to created_at.
    const noStart = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Now', place: 'Park', timeLabel: 'Now · ~2h',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    const readNoStart = await repo.getPulseByToken(noStart.token)
    expect(readNoStart!.startAt.getTime()).toBe(readNoStart!.createdAt.getTime())
  })

  it('an upcoming pulse (start in the future) stays in the active dash set, ordered by soonest start', async () => {
    const { repo, newToken, creator } = await fixtures()
    const soon = new Date(Date.now() + 30 * 60_000)   // starts in 30 min
    const later = new Date(Date.now() + 3 * 3_600_000) // starts in 3 h
    const upcomingLater = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Upcoming later', place: 'A', timeLabel: 'x',
      startAt: later, expiresAt: new Date(later.getTime() + 2 * 3_600_000),
      createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    const upcomingSoon = await repo.createPulse({
      token: newToken(), crewId: null, title: 'Upcoming soon', place: 'B', timeLabel: 'x',
      startAt: soon, expiresAt: new Date(soon.getTime() + 2 * 3_600_000),
      createdBy: creator.id, clientUuid: crypto.randomUUID(),
    })
    const { live, earlier } = await repo.pulsesForParticipant(creator.id, new Date(), 10)
    // Both are "not over" (expires_at > now) so both are active, and the soonest start leads.
    const idxSoon = live.findIndex((p) => p.token === upcomingSoon.token)
    const idxLater = live.findIndex((p) => p.token === upcomingLater.token)
    expect(idxSoon).toBeGreaterThanOrEqual(0)
    expect(idxLater).toBeGreaterThanOrEqual(0)
    expect(idxSoon).toBeLessThan(idxLater)
    expect(earlier.some((p) => p.token === upcomingSoon.token)).toBe(false)
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

  it('reassignPulseFootprint re-points person intents, keeping the earliest row on a pair collision', async () => {
    const { repo, newToken, creator } = await fixtures()
    const { sql } = await import('../db')
    const plan = await import('./plan')
    const ghost = await repo.createParticipant(newToken())
    const canonical = await repo.createParticipant(newToken())
    const target = await repo.createParticipant(newToken())
    // A plan to satisfy the source_plan_id FK (contents don't matter for the merge).
    const p = await plan.createPlan({ token: newToken(), creatorParticipantId: creator.id, intentText: 'x' })

    // Both the ghost and the canonical hold an intent toward `target` — a pair-PK collision on merge.
    // The canonical's is the OLDER row; the earliest must survive.
    await sql()`insert into pulse.person_intents (from_participant_id, to_participant_id, source_plan_id, created_at)
                values (${canonical.id}, ${target.id}, ${p.id}, now() - interval '10 days')`
    await sql()`insert into pulse.person_intents (from_participant_id, to_participant_id, source_plan_id, created_at)
                values (${ghost.id}, ${target.id}, ${p.id}, now())`
    // A ghost→canonical intent would become a self-tap after merge — it must be dropped.
    await sql()`insert into pulse.person_intents (from_participant_id, to_participant_id, source_plan_id)
                values (${ghost.id}, ${canonical.id}, ${p.id})`

    await repo.reassignPulseFootprint(ghost.id, canonical.id)

    const rows = await sql()`
      select from_participant_id, to_participant_id, created_at from pulse.person_intents
      where from_participant_id = ${canonical.id} or to_participant_id = ${canonical.id}
      order by created_at` as unknown as { toParticipantId: string; createdAt: string | Date }[]
    // One surviving row: canonical → target, the earlier (10-days-ago) one. No self-tap row.
    expect(rows).toHaveLength(1)
    expect(rows[0].toParticipantId).toBe(target.id)
    expect(Date.now() - new Date(rows[0].createdAt).getTime()).toBeGreaterThan(5 * 864e5)
    // The ghost holds nothing anymore.
    const ghostRows = await sql()`
      select 1 from pulse.person_intents where from_participant_id = ${ghost.id} or to_participant_id = ${ghost.id}`
    expect(ghostRows).toHaveLength(0)
  })

  // ---- venue facts + party size + count snapshot (add-restaurant-pods) ----

  async function livePulse(repo: typeof import('./repo'), newToken: () => string, createdBy: string,
    facts: { seatsCap?: number | null; countNeededBy?: Date | null } = {}) {
    return repo.createPulse({
      token: newToken(), crewId: null, title: 'Dinner', place: 'Trattoria', timeLabel: '8pm',
      expiresAt: new Date(Date.now() + 3_600_000), createdBy, clientUuid: crypto.randomUUID(),
      ...facts,
    })
  }

  it('facts unset means no change: null venue columns, null headcount block', async () => {
    const { repo, newToken, creator } = await fixtures()
    const { computeHeadcount } = await import('./serialize')
    const pulse = await livePulse(repo, newToken, creator.id)
    expect(pulse.seatsCap).toBeNull()
    expect(pulse.countNeededBy).toBeNull()
    expect(pulse.tableCalledAt).toBeNull()
    await repo.upsertResponse(pulse, creator.id, 'in', null, null)
    const rows = await repo.responsesForPulse(pulse.id)
    expect(computeHeadcount(pulse, rows, new Date())).toBeNull()
  })

  it('venue facts persist and read back; the cap never blocks a join', async () => {
    const { repo, newToken, creator } = await fixtures()
    const { computeHeadcount } = await import('./serialize')
    const cutoff = new Date(Date.now() + 1_800_000)
    const pulse = await livePulse(repo, newToken, creator.id, { seatsCap: 2, countNeededBy: cutoff })
    const read = await repo.getPulseByToken(pulse.token)
    expect(read!.seatsCap).toBe(2)
    expect(read!.countNeededBy!.getTime()).toBe(cutoff.getTime())
    // Three parties against a cap of 2 — every response still records (soft overflow, no gate).
    for (let i = 0; i < 3; i++) {
      const p = await repo.createParticipant(newToken())
      await repo.upsertResponse(pulse, p.id, 'in', null, null)
    }
    const rows = await repo.responsesForPulse(pulse.id)
    expect(rows).toHaveLength(3)
    const hc = computeHeadcount(read!, rows, new Date())!
    expect(hc.headcount).toBe(3)
    expect(hc.seatsCap).toBe(2) // over-cap is the view's soft line; nothing here blocked
  })

  it('one tap joins with party 0; a later status tap never resets a chosen party', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await livePulse(repo, newToken, creator.id, { seatsCap: 8 })
    const tapped = await repo.upsertResponse(pulse, creator.id, 'in', null, null)
    expect(tapped.partySize).toBe(0) // one-tap join, no extra step
    await repo.upsertResponse(pulse, creator.id, 'in', null, null, 2) // the optional follow-up
    const bumped = await repo.upsertResponse(pulse, creator.id, 'here', null, null) // party omitted
    expect(bumped.partySize).toBe(2)
  })

  it('headcount is Σ(1+party) over non-out; going out removes the whole party', async () => {
    const { repo, newToken, creator } = await fixtures()
    const { computeHeadcount } = await import('./serialize')
    const pulse = await livePulse(repo, newToken, creator.id, { seatsCap: 12 })
    await repo.upsertResponse(pulse, creator.id, 'in', null, null, 3)
    const other = await repo.createParticipant(newToken())
    await repo.upsertResponse(pulse, other.id, 'in', null, null)
    let hc = computeHeadcount(pulse, await repo.responsesForPulse(pulse.id), new Date())!
    expect(hc.people).toBe(2)
    expect(hc.guests).toBe(3)
    expect(hc.headcount).toBe(5)
    // Flipping to "out" drops the member AND their guests from the number.
    await repo.upsertResponse(pulse, creator.id, 'out', null, null)
    hc = computeHeadcount(pulse, await repo.responsesForPulse(pulse.id), new Date())!
    expect(hc.headcount).toBe(1)
  })

  it('count snapshot: the number locks at the cutoff, the door does not', async () => {
    const { repo, newToken, creator } = await fixtures()
    const { sql } = await import('../db')
    const { computeHeadcount, serializeResponses } = await import('./serialize')
    const cutoff = new Date() // cutoff = "now": fresh writes land after it
    const pulse = await livePulse(repo, newToken, creator.id, { seatsCap: 12, countNeededBy: cutoff })
    // Counted party: responded before the cutoff (backdate the row under it).
    await repo.upsertResponse(pulse, creator.id, 'in', null, null, 1)
    await sql()`update pulse.pulse_responses set updated_at = ${new Date(cutoff.getTime() - 60_000)}
                where pulse_id = ${pulse.id} and participant_id = ${creator.id}`
    // Late party: taps "in" +1 after the cutoff — still accepted, rendered "after the count".
    const late = await repo.createParticipant(newToken())
    await repo.upsertResponse(pulse, late.id, 'in', null, null, 1)
    const rows = await repo.responsesForPulse(pulse.id)
    const hc = computeHeadcount(pulse, rows, new Date())!
    expect(hc.lockedCount).toBe(2)  // creator + 1 guest, as of the cutoff
    expect(hc.headcount).toBe(4)    // the door stayed open
    expect(hc.afterCount).toBe(2)   // the late party of 2
    const pub = serializeResponses(rows, null, cutoff)
    expect(pub.find((r) => r.participantId === late.id)!.afterCount).toBe(true)
    expect(pub.find((r) => r.participantId === creator.id)!.afterCount).toBe(false)
  })

  it('a post-cutoff edit re-dates the whole party into "after the count"', async () => {
    const { repo, newToken, creator } = await fixtures()
    const { sql } = await import('../db')
    const { computeHeadcount } = await import('./serialize')
    const cutoff = new Date()
    const pulse = await livePulse(repo, newToken, creator.id, { countNeededBy: cutoff })
    await repo.upsertResponse(pulse, creator.id, 'in', null, null, 1)
    await sql()`update pulse.pulse_responses set updated_at = ${new Date(cutoff.getTime() - 60_000)}
                where pulse_id = ${pulse.id} and participant_id = ${creator.id}`
    let hc = computeHeadcount(pulse, await repo.responsesForPulse(pulse.id), new Date())!
    expect(hc.lockedCount).toBe(2)
    // They bump their party after the cutoff → recounted into "after the count".
    await repo.upsertResponse(pulse, creator.id, 'in', null, null, 2)
    hc = computeHeadcount(pulse, await repo.responsesForPulse(pulse.id), new Date())!
    expect(hc.lockedCount).toBe(0)
    expect(hc.afterCount).toBe(3)
  })

  it('table-called is idempotent: first tap sets and bumps, the second is a no-op', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await livePulse(repo, newToken, creator.id, { seatsCap: 6 })
    await repo.setTableCalled(pulse.id)
    const first = await repo.getPulseByToken(pulse.token)
    expect(first!.tableCalledAt).not.toBeNull()
    expect(Number(first!.version)).toBe(Number(pulse.version) + 1)
    await repo.setTableCalled(pulse.id)
    const second = await repo.getPulseByToken(pulse.token)
    expect(second!.tableCalledAt!.getTime()).toBe(first!.tableCalledAt!.getTime())
    expect(second!.version).toBe(first!.version) // no re-bump, nothing sent
  })

  // ---- pods (add-restaurant-pods) ----

  it('zero pods, zero change: the reads are empty and serialize to an empty array', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await livePulse(repo, newToken, creator.id)
    expect(await repo.podsForPulse(pulse.id)).toHaveLength(0)
    expect(await repo.podMembersForPulse(pulse.id)).toHaveLength(0)
  })

  it('a tier-0 participant opens a pod and is its owner-member; the version bumps', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await livePulse(repo, newToken, creator.id)
    const tier0 = await repo.createParticipant(newToken()) // unverified, display name only
    await repo.setDisplayName(tier0.id, 'Dana')
    const result = await repo.createPod(pulse, tier0.id, 'car', "Dana's car", 4, new Date())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ownerParticipantId).toBe(tier0.id)
    const members = await repo.podMembersForPulse(pulse.id)
    expect(members).toHaveLength(1)
    expect(members[0].participantId).toBe(tier0.id)
    const read = await repo.getPulseByToken(pulse.token)
    expect(Number(read!.version)).toBeGreaterThan(Number(pulse.version))
  })

  it('one pod at a time: joining a second pod atomically moves the member', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await livePulse(repo, newToken, creator.id)
    const dana = await repo.createParticipant(newToken())
    const car = await repo.createPod(pulse, dana.id, 'car', "Dana's car", 4, new Date())
    const walkers = await repo.createPod(pulse, creator.id, 'walk', 'walking over', null, new Date())
    if (!car.ok || !walkers.ok) throw new Error('setup failed')
    // Dana joins the walking pod → leaves the car in the same operation.
    const join = await repo.joinPod(pulse, walkers.value.id, dana.id, new Date())
    expect(join.ok && join.value.moved).toBe(true)
    const members = await repo.podMembersForPulse(pulse.id)
    expect(members.filter((m) => m.podId === car.value.id)).toHaveLength(0)
    expect(members.filter((m) => m.podId === walkers.value.id).map((m) => m.participantId).sort())
      .toEqual([creator.id, dana.id].sort())
    // Re-joining the pod you are already in is a quiet no-op.
    const again = await repo.joinPod(pulse, walkers.value.id, dana.id, new Date())
    expect(again.ok && !again.value.moved).toBe(true)
  })

  it('a full pod refuses the next rider; their pulse response is unaffected', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await livePulse(repo, newToken, creator.id)
    const pod = await repo.createPod(pulse, creator.id, 'car', 'small car', 2, new Date())
    if (!pod.ok) throw new Error('setup failed')
    const rider = await repo.createParticipant(newToken())
    await repo.joinPod(pulse, pod.value.id, rider.id, new Date()) // seat 2 of 2
    const fifth = await repo.createParticipant(newToken())
    await repo.upsertResponse(pulse, fifth.id, 'in', null, null)
    const refused = await repo.joinPod(pulse, pod.value.id, fifth.id, new Date())
    expect(refused).toEqual({ ok: false, error: 'pod_full' })
    expect((await repo.podMembersForPulse(pulse.id))).toHaveLength(2)
    const rows = await repo.responsesForPulse(pulse.id)
    expect(rows.find((r) => r.participantId === fifth.id)!.status).toBe('in') // response untouched
  })

  it('an uncapped pod always accepts joins', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await livePulse(repo, newToken, creator.id)
    const pod = await repo.createPod(pulse, creator.id, 'meetup', 'lobby first', null, new Date())
    if (!pod.ok) throw new Error('setup failed')
    for (let i = 0; i < 5; i++) {
      const p = await repo.createParticipant(newToken())
      const join = await repo.joinPod(pulse, pod.value.id, p.id, new Date())
      expect(join.ok).toBe(true)
    }
    expect(await repo.podMembersForPulse(pulse.id)).toHaveLength(6)
  })

  it('only the owner edits or disbands; seats can never shrink below the members', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await livePulse(repo, newToken, creator.id)
    const pod = await repo.createPod(pulse, creator.id, 'car', 'my car', 4, new Date())
    if (!pod.ok) throw new Error('setup failed')
    const rider = await repo.createParticipant(newToken())
    await repo.joinPod(pulse, pod.value.id, rider.id, new Date())
    // Non-owner edit and delete are rejected, pod unchanged.
    expect(await repo.updatePod(pulse, pod.value.id, rider.id, { seats: 2 }, new Date()))
      .toEqual({ ok: false, error: 'not_owner' })
    expect(await repo.deletePod(pulse, pod.value.id, rider.id, new Date()))
      .toEqual({ ok: false, error: 'not_owner' })
    // Owner shrinking below the current member count (2) is refused.
    expect(await repo.updatePod(pulse, pod.value.id, creator.id, { seats: 1 }, new Date()))
      .toEqual({ ok: false, error: 'seats_below_members' })
    // Owner edit within bounds works.
    const edited = await repo.updatePod(pulse, pod.value.id, creator.id, { label: 'the wagon', seats: 3 }, new Date())
    expect(edited.ok).toBe(true)
    if (edited.ok) {
      expect(edited.value.label).toBe('the wagon')
      expect(edited.value.seats).toBe(3)
    }
    // Owner disband removes the pod and every membership — quietly.
    const gone = await repo.deletePod(pulse, pod.value.id, creator.id, new Date())
    expect(gone.ok).toBe(true)
    expect(await repo.podsForPulse(pulse.id)).toHaveLength(0)
    expect(await repo.podMembersForPulse(pulse.id)).toHaveLength(0)
  })

  it('leave is self-only and quiet; leaving a pod you are not in is not_member', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await livePulse(repo, newToken, creator.id)
    const pod = await repo.createPod(pulse, creator.id, 'walk', 'walkers', null, new Date())
    if (!pod.ok) throw new Error('setup failed')
    const rider = await repo.createParticipant(newToken())
    await repo.joinPod(pulse, pod.value.id, rider.id, new Date())
    expect((await repo.leavePod(pulse, pod.value.id, rider.id, new Date())).ok).toBe(true)
    expect(await repo.leavePod(pulse, pod.value.id, rider.id, new Date()))
      .toEqual({ ok: false, error: 'not_member' })
    expect((await repo.podMembersForPulse(pulse.id)).map((m) => m.participantId)).toEqual([creator.id])
  })

  it('an over pulse rejects every pod write', async () => {
    const { repo, newToken, creator } = await fixtures()
    const pulse = await livePulse(repo, newToken, creator.id)
    const pod = await repo.createPod(pulse, creator.id, 'car', 'car', 4, new Date())
    if (!pod.ok) throw new Error('setup failed')
    const wrapped = await repo.closePulse(pulse)
    const now = new Date()
    const rider = await repo.createParticipant(newToken())
    expect((await repo.createPod(wrapped, creator.id, 'walk', 'late pod', null, now)).ok).toBe(false)
    expect((await repo.joinPod(wrapped, pod.value.id, rider.id, now)).ok).toBe(false)
    expect((await repo.leavePod(wrapped, pod.value.id, creator.id, now)).ok).toBe(false)
    expect((await repo.updatePod(wrapped, pod.value.id, creator.id, { seats: 5 }, now)).ok).toBe(false)
    expect((await repo.deletePod(wrapped, pod.value.id, creator.id, now)).ok).toBe(false)
  })

  it('pods serialize display names + existing status/ETA only; podless participants leak nothing', async () => {
    const { repo, newToken, creator } = await fixtures()
    const { serializePods } = await import('./serialize')
    const pulse = await livePulse(repo, newToken, creator.id)
    const dana = await repo.createParticipant(newToken())
    await repo.setDisplayName(dana.id, 'Dana')
    await repo.upsertResponse(pulse, dana.id, 'on_my_way', 10, null)
    const podless = await repo.createParticipant(newToken())
    await repo.setDisplayName(podless.id, 'Sam')
    await repo.upsertResponse(pulse, podless.id, 'in', null, null)
    const pod = await repo.createPod(pulse, dana.id, 'car', "Dana's car", 4, new Date())
    if (!pod.ok) throw new Error('setup failed')
    const pods = serializePods(
      await repo.podsForPulse(pulse.id), await repo.podMembersForPulse(pulse.id),
      await repo.responsesForPulse(pulse.id), dana.id,
    )
    expect(pods).toHaveLength(1)
    expect(pods[0].mine).toBe(true)
    expect(pods[0].owned).toBe(true)
    // The day-of grouping context rides the member's EXISTING response — nothing new stored.
    expect(pods[0].members).toEqual([{
      participantId: dana.id, displayName: 'Dana', status: 'on_my_way', etaMinutes: 10, me: true,
    }])
    // Nothing in the shape names, counts, or flags the podless participant.
    expect(JSON.stringify(pods)).not.toContain(podless.id)
    expect(JSON.stringify(pods)).not.toContain('Sam')
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

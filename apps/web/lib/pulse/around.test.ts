import { describe, it, expect, beforeAll } from 'vitest'

// DB-gated, mirroring lib/pulse/plan.test.ts: runs only when TEST_DATABASE_URL is set.
// Covers the coarse "who's around" reads — crew-overlap scoping, self/stranger exclusion, expiry.
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('around / network discovery (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
  })

  async function fixtures() {
    const repo = await import('./repo')
    const around = await import('./around')
    const { newToken } = await import('../ids')
    const { sql } = await import('../db')
    const viewer = await repo.createParticipant(newToken())
    const friend = await repo.createParticipant(newToken())
    const stranger = await repo.createParticipant(newToken())
    await repo.setDisplayName(friend.id, 'Sarah')
    // viewer + friend share a crew; stranger is in no shared crew.
    const crew = await repo.createCrew(newToken(), 'Crew', viewer.id)
    await sql()`insert into pulse.crew_members (crew_id, participant_id)
                values (${crew.id}, ${viewer.id}), (${crew.id}, ${friend.id})`
    return { around, viewer, friend, stranger }
  }

  it('roster shows crew-overlap people who are around; excludes self and strangers', async () => {
    const { around, viewer, friend, stranger } = await fixtures()
    await around.setAround(friend.id, 'tonight', 'Toronto')
    await around.setAround(stranger.id, 'tonight', null) // around, but no shared crew
    await around.setAround(viewer.id, 'now', null) // self — excluded from the roster
    const people = await around.peopleAround(viewer.id, new Date())
    const ids = people.map((p) => p.participantId)
    expect(ids).toContain(friend.id)
    expect(ids).not.toContain(stranger.id)
    expect(ids).not.toContain(viewer.id)
    const f = people.find((p) => p.participantId === friend.id)!
    expect(f).toMatchObject({ displayName: 'Sarah', label: 'around tonight', locale: 'Toronto', me: false })
  })

  it('expired around signals drop off the roster', async () => {
    const { around, viewer, friend } = await fixtures()
    const past = new Date(Date.now() - 24 * 3600_000) // around_until = past + few hours, still past
    await around.setAround(friend.id, 'now', null, past)
    const people = await around.peopleAround(viewer.id, new Date())
    expect(people.map((p) => p.participantId)).not.toContain(friend.id)
  })

  it('setAround upserts, myAround reads the live signal, clearAround removes it', async () => {
    const { around, viewer } = await fixtures()
    await around.setAround(viewer.id, 'now', 'West Village')
    await around.setAround(viewer.id, 'this_week', 'Brooklyn') // upsert same participant
    const mine = await around.myAround(viewer.id, new Date())
    expect(mine).toMatchObject({ aroundWindow: 'this_week', locale: 'Brooklyn' })
    await around.clearAround(viewer.id)
    expect(await around.myAround(viewer.id, new Date())).toBeNull()
  })

  it('getPublicAround assembles the viewer signal + their people', async () => {
    const { around, viewer, friend } = await fixtures()
    await around.setAround(friend.id, 'this_week', 'Toronto')
    await around.setAround(viewer.id, 'tonight', 'Toronto')
    const pub = await around.getPublicAround({ participantId: viewer.id, displayName: null, verified: false }, new Date())
    expect(pub.mine).toMatchObject({ aroundWindow: 'tonight', locale: 'Toronto' })
    expect(pub.people.map((p) => p.participantId)).toContain(friend.id)
  })
})

import { describe, it, expect, beforeAll } from 'vitest'

// DB-gated (same discipline as repo.test.ts). Covers the roster semantics: idempotent join,
// silent leave, version bumps for pollers. Tier gating itself is requireVerified (see
// phone.test.ts gating matrix) — enforced in routes, not in these repo functions.
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('crew membership (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
  })

  async function fixtures() {
    const repo = await import('./repo')
    const { newToken } = await import('../ids')
    const creator = await repo.createParticipant(newToken())
    await repo.setDisplayName(creator.id, 'Creator')
    const crew = await repo.createCrew(newToken(), 'Roster', creator.id)
    return { repo, newToken, creator, crew }
  }

  it('join is idempotent — double join keeps one row, one version bump', async () => {
    const { repo, crew, creator } = await fixtures()
    const v0 = (await repo.getCrewById(crew.id))!.version
    await repo.addCrewMember(crew.id, creator.id)
    await repo.addCrewMember(crew.id, creator.id)
    const members = await repo.membersForCrew(crew.id)
    expect(members).toHaveLength(1)
    expect(members[0].participantId).toBe(creator.id)
    expect(members[0].displayName).toBe('Creator')
    const v1 = (await repo.getCrewById(crew.id))!.version
    expect(Number(v1) - Number(v0)).toBe(1) // second join was a no-op
  })

  it('leave removes the row silently and bumps the version for pollers', async () => {
    const { repo, newToken, crew, creator } = await fixtures()
    const other = await repo.createParticipant(newToken())
    await repo.addCrewMember(crew.id, creator.id)
    await repo.addCrewMember(crew.id, other.id)
    const before = (await repo.getCrewById(crew.id))!.version

    await repo.removeCrewMember(crew.id, other.id)
    const members = await repo.membersForCrew(crew.id)
    expect(members.map((m) => m.participantId)).toEqual([creator.id])
    const after = (await repo.getCrewById(crew.id))!.version
    expect(Number(after)).toBeGreaterThan(Number(before))

    // leaving twice is a quiet no-op (no error, no extra bump)
    await repo.removeCrewMember(crew.id, other.id)
    expect((await repo.getCrewById(crew.id))!.version).toBe(after)
  })

  it('membership checks and phone reads stay separate: roster rows carry no phone', async () => {
    const { repo, crew, creator } = await fixtures()
    await repo.setPhoneVerified(creator.id, `+1555${String(Date.now()).slice(-7)}`)
    await repo.addCrewMember(crew.id, creator.id)
    expect(await repo.isCrewMember(crew.id, creator.id)).toBe(true)
    const members = await repo.membersForCrew(crew.id)
    expect(Object.keys(members[0]).sort()).toEqual(['displayName', 'joinedAt', 'participantId'])
  })
})

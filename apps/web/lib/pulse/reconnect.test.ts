/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic-import test helpers over the loosely-
   typed pulse modules; same boundary idiom the lib files use. */
import { describe, it, expect, beforeAll } from 'vitest'

// DB-gated, mirroring lib/pulse/plan.test.ts. Covers the derived recency engine: co-presence from
// struck plans only, crew-mate scoping, opt-in / cadence / mute gating, staleness floor.
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('reconnect / relationship intelligence (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
  })

  async function ctx() {
    const repo = await import('./repo')
    const plan = await import('./plan')
    const reconnect = await import('./reconnect')
    const { newToken } = await import('../ids')
    const { sql } = await import('../db')
    return { repo, plan, reconnect, newToken, sql }
  }

  async function person(repo: any, newToken: any, name: string) {
    const p = await repo.createParticipant(newToken())
    await repo.setDisplayName(p.id, name)
    return p
  }

  // A struck plan both `a` and `b` attended (both picked the winning option), created `daysAgo` ago.
  async function struckTogether(c: any, a: any, b: any, daysAgo: number) {
    const { plan, newToken, sql } = c
    const p = await plan.createPlan({ token: newToken(), creatorParticipantId: a.id, intentText: 'x', confirmThreshold: 2 })
    const [opt] = await plan.setOptions(p.id, [{ kind: 'time', label: 'X', startsAt: new Date(Date.now() + 3 * 864e5) }])
    await plan.publishPlan(p.id, a.id)
    await plan.recordAvailabilityAndMaybeStrike(p.id, opt.id, a.id, new Date())
    await plan.recordAvailabilityAndMaybeStrike(p.id, opt.id, b.id, new Date()) // strikes
    await sql()`update pulse.plans set created_at = now() - (${daysAgo} || ' days')::interval where id = ${p.id}`
    return p
  }

  it('recency is derived from struck plans; crew-mates only; never-together sorts first', async () => {
    const c = await ctx()
    const { repo, reconnect, newToken, sql } = c
    const viewer = await person(repo, newToken, 'Me')
    const seen = await person(repo, newToken, 'Sarah')
    const never = await person(repo, newToken, 'Mike')
    const stranger = await person(repo, newToken, 'Nobody')
    const crew = await repo.createCrew(newToken(), 'Crew', viewer.id)
    await sql()`insert into pulse.crew_members (crew_id, participant_id)
                values (${crew.id}, ${viewer.id}), (${crew.id}, ${seen.id}), (${crew.id}, ${never.id})`
    await struckTogether(c, viewer, seen, 30) // co-attended 30 days ago

    const mates = await reconnect.staleCrewMates(viewer.id)
    const ids = mates.map((m: any) => m.participantId)
    expect(ids).toContain(seen.id)
    expect(ids).toContain(never.id)
    expect(ids).not.toContain(stranger.id) // no shared crew
    expect(ids).not.toContain(viewer.id)
    expect(ids[0]).toBe(never.id) // never-together is stalest → first
    const seenRow = mates.find((m: any) => m.participantId === seen.id)!
    expect(seenRow.lastTogetherAt).not.toBeNull()
  })

  it('suggestion is off by default and respects opt-in, mute, cadence, and the staleness floor', async () => {
    const c = await ctx()
    const { repo, reconnect, newToken, sql } = c
    const viewer = await person(repo, newToken, 'Me')
    const never = await person(repo, newToken, 'Mike')
    const seen = await person(repo, newToken, 'Sarah')
    const crew = await repo.createCrew(newToken(), 'Crew', viewer.id)
    await sql()`insert into pulse.crew_members (crew_id, participant_id)
                values (${crew.id}, ${viewer.id}), (${crew.id}, ${never.id}), (${crew.id}, ${seen.id})`
    await struckTogether(c, viewer, seen, 30)

    // Off by default
    expect(await reconnect.getSuggestion(viewer.id, new Date())).toBeNull()

    // Opt in → stalest non-muted (never-together) surfaces
    await reconnect.setEnabled(viewer.id, true)
    const s1 = await reconnect.getSuggestion(viewer.id, new Date())
    expect(s1?.participantId).toBe(never.id)
    expect(s1?.daysSince).toBeNull()

    // Mute the never-together one → next stalest is Sarah (30d ago)
    await reconnect.mute(viewer.id, never.id)
    const s2 = await reconnect.getSuggestion(viewer.id, new Date())
    expect(s2?.participantId).toBe(seen.id)
    expect(s2?.daysSince).toBeGreaterThanOrEqual(29)

    // Cadence cap: just shown → nothing for now
    await reconnect.markShown(viewer.id, new Date())
    expect(await reconnect.getSuggestion(viewer.id, new Date())).toBeNull()
  })

  it('does not nudge about a crew-mate seen recently (staleness floor)', async () => {
    const c = await ctx()
    const { repo, reconnect, newToken, sql } = c
    const viewer = await person(repo, newToken, 'Me')
    const recent = await person(repo, newToken, 'Fresh')
    const crew = await repo.createCrew(newToken(), 'Crew', viewer.id)
    await sql()`insert into pulse.crew_members (crew_id, participant_id)
                values (${crew.id}, ${viewer.id}), (${crew.id}, ${recent.id})`
    await struckTogether(c, viewer, recent, 3) // seen 3 days ago — too fresh
    await reconnect.setEnabled(viewer.id, true)
    expect(await reconnect.getSuggestion(viewer.id, new Date())).toBeNull()
  })
})

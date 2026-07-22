/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic-import test helpers over the loosely-
   typed pulse modules; same boundary idiom the lib files use. */
import { describe, it, expect, beforeAll } from 'vitest'

// DB-gated, mirroring reconnect.test.ts. Covers the pure read-time resolver: compound collapse,
// unmatched intents producing (and writing) nothing, and unknown availability passing through.
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('intent resolver (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
  })

  const HOUR = 3600_000

  async function ctx() {
    const repo = await import('./repo')
    const plan = await import('./plan')
    const ember = await import('./ember')
    const pi = await import('./person-intent')
    const resolver = await import('./intent-resolver')
    const { newToken } = await import('../ids')
    const { sql } = await import('../db')
    return { repo, plan, ember, pi, resolver, newToken, sql }
  }

  async function person(c: any, name: string) {
    const p = await c.repo.createParticipant(c.newToken())
    await c.repo.setDisplayName(p.id, name)
    return p
  }

  // A completed plan `a` and `b` both marked the winner of, with both having tapped the ember (a
  // MUTUAL ember on `activity`). Returns the completed plan.
  async function mutualEmber(c: any, a: any, b: any, activity: string) {
    const now = new Date()
    const p = await c.plan.createPlan({ token: c.newToken(), creatorParticipantId: a.id, intentText: activity, confirmThreshold: 2 })
    const [win] = await c.plan.setOptions(p.id, [{ kind: 'time', label: 'Sat 10 AM', startsAt: new Date(now.getTime() - 6 * HOUR), aiRank: 0 }])
    await c.plan.publishPlan(p.id, a.id)
    await c.plan.recordAvailabilityAndMaybeStrike(p.id, win.id, a.id, now)
    await c.plan.recordAvailabilityAndMaybeStrike(p.id, win.id, b.id, now)
    const completed = await c.plan.resolvePlanState((await c.plan.getPlanById(p.id))!, now)
    await c.ember.tapEmber(completed, a.id)
    await c.ember.tapEmber(completed, b.id)
    return completed
  }

  it('a compound match (mutual ember + mutual person intent) collapses to ONE candidate', async () => {
    const c = await ctx()
    const me = await person(c, 'Me')
    const kat = await person(c, 'Kat')
    const done = await mutualEmber(c, me, kat, 'climbing')
    await c.pi.tapPerson(done, me.id, kat.id)
    await c.pi.tapPerson(done, kat.id, me.id) // mutual person intent

    const candidates = await c.resolver.resolveIntents(me.id)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({ kind: 'compound', people: ['Kat'] })
    expect(candidates[0].activity).toContain('climbing')
  })

  it('unmatched (one-sided) intents produce nothing and write nothing', async () => {
    const c = await ctx()
    const me = await person(c, 'Me')
    const kat = await person(c, 'Kat')
    const done = await mutualEmber(c, me, kat, 'dinner')
    // Undo the mutual ember so there's no matched signal at all: withdraw both taps.
    await c.ember.untapEmber(done, me.id)
    await c.ember.untapEmber(done, kat.id)
    await c.pi.tapPerson(done, me.id, kat.id) // one-sided only — Kat never taps back

    const [{ n: intentsBefore }] = await c.sql()`select count(*)::int as n from pulse.person_intents`
    const [{ n: plansBefore }] = await c.sql()`select count(*)::int as n from pulse.plans`

    const candidates = await c.resolver.resolveIntents(me.id)
    expect(candidates).toEqual([])

    const [{ n: intentsAfter }] = await c.sql()`select count(*)::int as n from pulse.person_intents`
    const [{ n: plansAfter }] = await c.sql()`select count(*)::int as n from pulse.plans`
    expect(intentsAfter).toBe(intentsBefore) // resolver writes no intents
    expect(plansAfter).toBe(plansBefore) // and no plan/draft row materializes
  })

  it('a mutual person intent with no availability declared appears with NO suggested window', async () => {
    const c = await ctx()
    const me = await person(c, 'Me')
    const kat = await person(c, 'Kat')
    // Give them a shared completed plan so person taps are eligible, but no mutual ember.
    const done = await mutualEmber(c, me, kat, 'coffee')
    await c.ember.untapEmber(done, me.id)
    await c.ember.untapEmber(done, kat.id)
    await c.pi.tapPerson(done, me.id, kat.id)
    await c.pi.tapPerson(done, kat.id, me.id) // mutual person intent, no ember

    const candidates = await c.resolver.resolveIntents(me.id)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({ kind: 'person', people: ['Kat'], activity: null })
    expect(candidates[0].seedIntent).toBe('catch up with Kat') // pair alone, reconnect-style
    expect(candidates[0].suggestedWindow).toBeNull() // unknown availability -> no window, still shown
  })
})

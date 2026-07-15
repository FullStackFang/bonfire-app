import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// Mock next/headers with an in-memory cookie jar so identity can be exercised outside a request.
const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v) },
  }),
}))

// DB-gated (same discipline as repo.test.ts): the identity round-trip needs real participant rows.
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('pulse identity (requires TEST_DATABASE_URL)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url
    process.env.PG_POOL_MAX = '4'
  })
  beforeEach(() => { jar.clear() })

  it('resolveOrCreateParticipant creates exactly once per device', async () => {
    const { resolveOrCreateParticipant, COOKIE } = await import('./identity')
    const first = await resolveOrCreateParticipant()
    expect(jar.get(COOKIE)).toBe(first.token)
    const second = await resolveOrCreateParticipant()
    expect(second.id).toBe(first.id) // same device → same participant, no duplicate
  })

  it('sign-free cookie round-trips: the raw token resolves the viewer (no HMAC)', async () => {
    const { resolveOrCreateParticipant, getViewer, COOKIE } = await import('./identity')
    const created = await resolveOrCreateParticipant()
    const cookieValue = jar.get(COOKIE)!
    expect(cookieValue).toBe(created.token) // the cookie is the plain token, nothing signed
    const viewer = await getViewer()
    expect(viewer?.id).toBe(created.id)
  })

  it('a missing/garbage cookie mints a fresh participant rather than erroring', async () => {
    const { resolveOrCreateParticipant, getViewer, COOKIE } = await import('./identity')
    jar.set(COOKIE, 'not-a-real-token')
    expect(await getViewer()).toBeNull()
    const p = await resolveOrCreateParticipant() // must not throw "already joined"
    expect(p.id).toBeTruthy()
    expect(jar.get(COOKIE)).toBe(p.token)
  })
})

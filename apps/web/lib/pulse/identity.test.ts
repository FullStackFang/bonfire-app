import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// Mock next/headers with an in-memory cookie jar so identity can be exercised outside a request.
const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v) },
    delete: (k: string) => { jar.delete(k) },
  }),
}))

// Cookie-only (no DB): sign-out is a cookie delete; a cookieless getViewer never touches the DB.
describe('clearParticipant', () => {
  beforeEach(() => { jar.clear() })

  it('deletes the identity cookie and the viewer resolves null', async () => {
    const { clearParticipant, getViewer, COOKIE } = await import('./identity')
    jar.set(COOKIE, 'some-device-token')
    await clearParticipant()
    expect(jar.has(COOKIE)).toBe(false)
    expect(await getViewer()).toBeNull()
  })

  it('is a no-op on a device with no identity cookie', async () => {
    const { clearParticipant, COOKIE } = await import('./identity')
    await clearParticipant()
    expect(jar.has(COOKIE)).toBe(false)
  })

  it('POST /api/pulse/signout clears the cookie and the viewer resolves null', async () => {
    const { getViewer, COOKIE } = await import('./identity')
    const { POST } = await import('../../app/api/pulse/signout/route')
    jar.set(COOKIE, 'some-device-token')
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(jar.has(COOKIE)).toBe(false)
    expect(await getViewer()).toBeNull()
  })
})

// POST /api/pulse/name (the login name step's endpoint) — reject paths are cookie-only;
// the happy path needs a real participant row (DB-gated section below).
describe('POST /api/pulse/name reject paths', () => {
  beforeEach(() => { jar.clear() })

  const post = (body: string) =>
    new Request('http://test/api/pulse/name', { method: 'POST', body })

  it('400s when the body has no name', async () => {
    const { POST } = await import('../../app/api/pulse/name/route')
    const res = await POST(post('{}'))
    expect(res.status).toBe(400)
  })

  it('401s without an identity cookie', async () => {
    const { POST } = await import('../../app/api/pulse/name/route')
    const res = await POST(post(JSON.stringify({ name: 'Mo' })))
    expect(res.status).toBe(401)
  })
})

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

  it('POST /api/pulse/name: 422 on empty-after-trim, happy path trims and sets the name', async () => {
    const { resolveOrCreateParticipant } = await import('./identity')
    const { POST } = await import('../../app/api/pulse/name/route')
    await resolveOrCreateParticipant() // device now has an identity cookie in the jar

    const post = (name: string) =>
      POST(new Request('http://test/api/pulse/name', { method: 'POST', body: JSON.stringify({ name }) }))

    const empty = await post('   ')
    expect(empty.status).toBe(422)

    const res = await post('  Mo Fang  ')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.viewer.displayName).toBe('Mo Fang')
  })
})

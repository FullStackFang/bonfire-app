import { describe, it, expect } from 'vitest'
import { newToken } from './ids'

describe('newToken', () => {
  it('is url-safe and long enough to be unguessable', () => {
    const t = newToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{24,}$/)
  })
  it('is unique across calls', () => {
    const seen = new Set(Array.from({ length: 100 }, () => newToken()))
    expect(seen.size).toBe(100)
  })
})

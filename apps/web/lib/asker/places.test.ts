import { describe, it, expect } from 'vitest'
import { glowOpacity } from './places'

describe('glowOpacity — return-glow rewards depth, not novelty', () => {
  it('scales from a dim floor to full brightness at the max', () => {
    expect(glowOpacity(1, 4)).toBeCloseTo(0.35 + 0.65 * 0.25)
    expect(glowOpacity(4, 4)).toBe(1)
  })
  it('handles the single-venue case', () => {
    expect(glowOpacity(1, 1)).toBe(1)
  })
})

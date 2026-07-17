import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { classifyNominatim } from './geo'

// Pure — the confidence gate that decides which matches become a map. No network.
describe('classifyNominatim', () => {
  it('maps a precise, relevant place to resolved', () => {
    expect(classifyNominatim({ importance: 0.6, addresstype: 'amenity', class: 'amenity', type: 'bar' })).toBe('resolved')
    expect(classifyNominatim({ importance: 0.4, addresstype: 'house', class: 'place', type: 'house' })).toBe('resolved')
  })

  it('holds a bare city/region centroid at low_confidence (never a wrong pin)', () => {
    expect(classifyNominatim({ importance: 0.9, addresstype: 'city', class: 'place', type: 'city' })).toBe('low_confidence')
    expect(classifyNominatim({ importance: 0.8, addresstype: 'state', class: 'boundary', type: 'administrative' })).toBe('low_confidence')
  })

  it('treats a weak, non-precise match as low_confidence', () => {
    expect(classifyNominatim({ importance: 0.1, addresstype: 'road', class: 'highway', type: 'residential' })).toBe('low_confidence')
  })

  it('promotes a strongly-relevant non-coarse match to resolved', () => {
    expect(classifyNominatim({ importance: 0.7, addresstype: 'road', class: 'highway', type: 'primary' })).toBe('resolved')
  })

  it('parses a string importance (Nominatim returns strings)', () => {
    expect(classifyNominatim({ importance: '0.62', addresstype: 'shop', class: 'shop', type: 'cafe' })).toBe('resolved')
  })

  it('defaults missing signals to low_confidence, not a map', () => {
    expect(classifyNominatim({})).toBe('low_confidence')
  })
})

// The best-effort contract: every failure path resolves to `unresolved` with null coordinates.
// `geocode` reads config at module load, so we re-import per env variation with resetModules.
describe('geocode failure + no-config paths', () => {
  const OLD = process.env
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...OLD }
  })
  afterEach(() => {
    process.env = OLD
    vi.restoreAllMocks()
  })

  it('empty place is unresolved with no request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { geocode } = await import('./geo')
    expect(await geocode('   ')).toEqual({ lat: null, lng: null, status: 'unresolved' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('GEOCODER_DISABLED=1 is a no-op: unresolved, no request', async () => {
    process.env.GEOCODER_DISABLED = '1'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { geocode } = await import('./geo')
    expect(await geocode('The Anchor')).toEqual({ lat: null, lng: null, status: 'unresolved' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('a thrown/timed-out fetch degrades to unresolved', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'))
    const { geocode } = await import('./geo')
    expect(await geocode('The Anchor')).toEqual({ lat: null, lng: null, status: 'unresolved' })
  })

  it('a non-ok response degrades to unresolved', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }))
    const { geocode } = await import('./geo')
    expect(await geocode('The Anchor')).toEqual({ lat: null, lng: null, status: 'unresolved' })
  })

  it('an empty result array is unresolved', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json([]))
    const { geocode } = await import('./geo')
    expect(await geocode('nowhere at all')).toEqual({ lat: null, lng: null, status: 'unresolved' })
  })

  it('a resolved match returns its coordinate + status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json([{ lat: '40.7189', lon: '-73.9877', importance: 0.6, addresstype: 'amenity', class: 'amenity', type: 'bar' }]),
    )
    const { geocode } = await import('./geo')
    expect(await geocode('The Anchor, Rivington')).toEqual({ lat: 40.7189, lng: -73.9877, status: 'resolved' })
  })

  it('a low_confidence match keeps its coordinate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json([{ lat: '40.7128', lon: '-74.006', importance: 0.9, addresstype: 'city', class: 'place', type: 'city' }]),
    )
    const { geocode } = await import('./geo')
    expect(await geocode('New York')).toEqual({ lat: 40.7128, lng: -74.006, status: 'low_confidence' })
  })

  it('a non-numeric coordinate is unresolved', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json([{ lat: 'nope', lon: 'nope', importance: 0.6, addresstype: 'amenity', class: 'amenity' }]),
    )
    const { geocode } = await import('./geo')
    expect(await geocode('garbage')).toEqual({ lat: null, lng: null, status: 'unresolved' })
  })
})

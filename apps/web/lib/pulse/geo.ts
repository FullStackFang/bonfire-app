// Server-side geocoder seam: resolve a pulse's free-text `place` to a coordinate once, at
// creation. Best-effort by contract — ANY failure (network error, timeout, empty result, or no
// provider configured) resolves to `unresolved` with null coordinates so pulse creation never
// blocks or fails (spec: "Geocoding never blocks creation"). The provider is swappable behind
// this one module; the detail UI and create flow never learn which geocoder answered.
//
// Confidence gate: only a high-confidence match becomes `resolved` (the only status that renders
// a map). An ambiguous/approximate match is `low_confidence` — its coordinate is kept but treated
// as non-mappable downstream, so vague places ("downtown", "my place") never drop a wrong pin.

export type GeoStatus = 'resolved' | 'low_confidence' | 'unresolved'

export type GeoResult = {
  lat: number | null
  lng: number | null
  status: GeoStatus
}

const UNRESOLVED: GeoResult = { lat: null, lng: null, status: 'unresolved' }

// How long to wait on the geocoder before giving up and creating the pulse anyway.
const TIMEOUT_MS = Number(process.env.GEOCODER_TIMEOUT_MS ?? 2500)

// Default provider: Nominatim / OpenStreetMap — keyless, rate-limited. Overridable to any
// Nominatim-compatible endpoint (a self-hosted instance, or a keyed provider via GEOCODER_KEY).
// Absent config still works: the default endpoint is public, so `geocode` stays a real call in
// dev; set GEOCODER_DISABLED=1 to force the no-op (stylized tile everywhere) with no requests.
const ENDPOINT = process.env.GEOCODER_URL ?? 'https://nominatim.openstreetmap.org/search'
const DISABLED = process.env.GEOCODER_DISABLED === '1'

// Nominatim asks for an identifying UA / contact. Overridable; a sane default keeps dev working.
const USER_AGENT = process.env.GEOCODER_USER_AGENT ?? 'bonfire-pulse/1.0 (+https://bonfire.app)'

// Map a Nominatim result to our three-state confidence. `importance` is Nominatim's relevance
// signal (0..1); an `address` with a house number or a named venue is a confident point, whereas
// a bare city/region centroid is approximate. The thresholds live here so swapping providers only
// touches this mapping — never the UI.
export function classifyNominatim(result: {
  importance?: number | string | null
  addresstype?: string | null
  class?: string | null
  type?: string | null
}): GeoStatus {
  const importance =
    typeof result.importance === 'string' ? Number(result.importance) : result.importance ?? 0

  // A precise place: a specific address, building, amenity, shop, or named POI.
  const addresstype = result.addresstype ?? ''
  const precise =
    addresstype === 'house' ||
    addresstype === 'building' ||
    addresstype === 'amenity' ||
    addresstype === 'shop' ||
    addresstype === 'leisure' ||
    addresstype === 'tourism' ||
    result.class === 'amenity' ||
    result.class === 'shop' ||
    result.class === 'leisure' ||
    result.class === 'tourism'

  // A coarse centroid: a whole city / suburb / region / country — a wrong pin if we mapped it.
  const coarse =
    addresstype === 'city' ||
    addresstype === 'town' ||
    addresstype === 'village' ||
    addresstype === 'suburb' ||
    addresstype === 'state' ||
    addresstype === 'country' ||
    result.class === 'boundary' ||
    result.class === 'place'

  if (precise && importance >= 0.35) return 'resolved'
  if (coarse) return 'low_confidence'
  // Non-coarse match with a solid relevance score is mappable; otherwise hold it back.
  if (importance >= 0.5) return 'resolved'
  return 'low_confidence'
}

/**
 * Resolve `place` to a coordinate + confidence. Never throws — returns `unresolved` on any
 * failure, timeout, empty result, or when geocoding is disabled. `low_confidence` carries its
 * coordinate but the detail surface treats it as non-mappable.
 */
export async function geocode(place: string): Promise<GeoResult> {
  const q = place.trim()
  if (DISABLED || !q) return UNRESOLVED

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const url = new URL(ENDPOINT)
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')
    url.searchParams.set('addressdetails', '0')
    const key = process.env.GEOCODER_KEY
    if (key) url.searchParams.set('key', key)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
    if (!res.ok) return UNRESOLVED

    const body = (await res.json()) as unknown
    const first = Array.isArray(body) ? body[0] : null
    if (!first) return UNRESOLVED

    const lat = Number(first.lat)
    const lng = Number(first.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return UNRESOLVED

    const status = classifyNominatim(first)
    // `low_confidence` keeps its coordinate; `unresolved` never has one (nothing to keep here).
    return { lat, lng, status }
  } catch {
    // AbortError (timeout), network failure, JSON parse error — all degrade the same way.
    return UNRESOLVED
  } finally {
    clearTimeout(timer)
  }
}

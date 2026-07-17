'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cartoVoyagerStyle, MAP_MIST, light } from '@bonfire/ui-tokens'
import { EmberMark } from '../../ui.client'

// The resolved-place map tile. Loaded lazily via next/dynamic (ssr:false) from Pulse.client only
// when a pulse has `place_geo_status = 'resolved'` and coordinates — so maplibre-gl (and the tile
// requests) never enter the page for unresolved/low_confidence/no-config pulses.
//
// It reproduces the neighborhood map's warm, watercolor treatment (mobile FogMap): the Carto
// Voyager basemap is desaturated to grayscale under a cream MIST, and warm colour + an ember glow
// bloom back in ONLY around the spot — so the venue reads as a lit pool on a hand-tinted map,
// not a generic full-colour basemap. Non-interactive; wrapped in a link to full maps.

// Ember glow bloomed around the marker (matches FogMap's lit-pool colour + heat).
const WARM_BLOOM =
  `radial-gradient(circle at 50% 50%, ${light.ember}55 0%, ${light.emberGlow}2b 14%, rgba(232,80,47,0) 34%),` +
  ` radial-gradient(150% 150% at 50% 50%, rgba(250,247,243,0) 22%, ${MAP_MIST} 78%)`

// The saturation-blend veil that greys the map out to the mist, punched open at the centre so the
// venue's immediate surroundings keep their real colour (the "discovered" pool).
const DESAT_MASK =
  'radial-gradient(130% 130% at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 15%, #000 52%)'

export default function PulseMap({
  lat, lng, place, zoom = 15,
}: {
  lat: number
  lng: number
  place: string
  zoom?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const map = new maplibregl.Map({
      container,
      style: cartoVoyagerStyle(),
      center: [lng, lat],
      zoom,
      interactive: false, // glanceable tile — no pan/zoom/rotate
      attributionControl: false,
    })
    return () => map.remove()
  }, [lat, lng, zoom])

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`

  return (
    <a
      className="bp-map bpd-map bpd-map--live"
      href={mapsHref}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${place} in maps`}
    >
      {/* isolate keeps the saturation blend scoped to the tile (as FogMap does) */}
      <span className="bpd-map-stage" aria-hidden>
        {/* inline absolute fill so the maplibre container beats maplibre-gl.css's own position rule */}
        <div ref={containerRef} className="bpd-map-canvas" style={{ position: 'absolute', inset: 0 }} />
        <span
          className="bpd-map-desat"
          style={{ WebkitMaskImage: DESAT_MASK, maskImage: DESAT_MASK }}
        />
        <span className="bpd-map-warm" style={{ background: WARM_BLOOM }} />
      </span>
      <span className="bpd-map-marker" aria-hidden>
        <EmberMark size={26} glow />
      </span>
      <span className="bp-map-tag">{place}</span>
      <span className="bp-map-hint">open in maps ↗</span>
      <span className="bpd-map-attr" aria-hidden>© OpenStreetMap © CARTO</span>
    </a>
  )
}

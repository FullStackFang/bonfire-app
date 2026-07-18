'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cartoVoyagerStyle, MAP_MIST, light } from '@bonfire/ui-tokens'

// Backdrop-only basemap for the unified pulse hero. Loaded lazily via next/dynamic (ssr:false)
// from Pulse.client only when a pulse has `place_geo_status = 'resolved'` and coordinates — so
// maplibre-gl (and the tile requests) never enter the page for unresolved pulses.
//
// Unlike the old PulseMap tile, this renders NO chrome (no marker, no tag, no link): the fire,
// the people, and the overlays are drawn on top by the hero. It reproduces the neighborhood
// map's warm watercolor treatment (mobile FogMap): the Carto Voyager basemap is desaturated to
// grayscale under a cream MIST, with warm colour + an ember glow blooming back in around the
// centre (the venue) so the venue reads as a lit pool the fire sits in. Non-interactive.

// The basemap is greyed to the mist by a `filter: grayscale` on the canvas (reliable at any tile
// size, unlike a saturation-blend veil which the large hero outgrows). Warmth blooms back over the
// centre: ember heat right under the fire, then a cream mist that fades the streets toward the
// edges so the faces and overlays stay legible on top.
const WARM_BLOOM =
  `radial-gradient(circle at 50% 48%, ${light.ember}59 0%, ${light.emberGlow}30 13%, rgba(232,80,47,0) 33%),` +
  ` radial-gradient(150% 130% at 50% 48%, rgba(246,243,239,0) 24%, ${MAP_MIST} 70%),` +
  ` radial-gradient(150% 130% at 50% 48%, rgba(246,243,239,0) 44%, rgba(246,243,239,0.55) 100%)`

export default function HeroMap({ lat, lng, zoom = 15 }: { lat: number; lng: number; zoom?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const map = new maplibregl.Map({
      container,
      style: cartoVoyagerStyle(),
      center: [lng, lat],
      zoom,
      interactive: false, // cinematic frame — no pan/zoom/rotate
      attributionControl: false,
    })
    return () => map.remove()
  }, [lat, lng, zoom])

  return (
    <span className="bpd-hero-mapstage" aria-hidden>
      <div ref={containerRef} className="bpd-hero-mapcanvas" style={{ position: 'absolute', inset: 0 }} />
      <span className="bpd-hero-mapwarm" style={{ background: WARM_BLOOM }} />
    </span>
  )
}

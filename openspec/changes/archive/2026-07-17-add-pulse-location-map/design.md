## Context

`pulse.pulses.place` is free text (e.g. "The Anchor · Bar on Rivington", "New York", "my place"), captured with no coordinates. The `/p/s/[token]` desktop details band currently renders a stylized grid tile for the place. The mobile app already renders maps with MapLibre (`@maplibre/maplibre-react-native` on native, `maplibre-gl` on web) behind a `MapStage`/`FogMap` abstraction; `apps/web` has no map dependency today. Any real map requires two provider services: a **geocoder** (text → lat/lng) and **tile style** (rendered basemap). Places are user‑typed and often vague, so a meaningful share will not geocode cleanly.

## Goals / Non-Goals

**Goals:**
- Show a real, brand‑styled map for pulses whose place resolves to a confident coordinate.
- Never show a blank, errored, or wrongly‑pinned map: degrade to today's stylized tile.
- Keep the provider behind one seam so tile style and geocoder can be swapped by config.
- Stay consistent with the mobile MapLibre stack; work with zero map config in local/dev.

**Non-Goals:**
- Interactive exploration (pan/zoom/search) in the tile. It is a glanceable tile that taps through to full maps.
- Backfilling coordinates for pulses created before this change (they keep the stylized tile).
- Letting the creator manually place/adjust a pin, or storing a structured address. Out of scope; possible follow‑up.
- Any map on the mobile pulse surface (this change is the web detail page only).

## Decisions

### Geocode once, at creation, server‑side
Geocode in the create path (`insertPulse` / the `pulses` API route), not on every detail render, so the cost is one call per pulse and the coordinate is stable and cacheable. Persist `place_lat`, `place_lng`, `place_geo_status`. The geocode call is wrapped in a bounded timeout and a try/catch that always resolves to `unresolved` on any failure — creation never depends on it.
- *Alternative considered:* geocode lazily on first detail view. Rejected: repeated calls, render‑path latency, and harder caching for a value that never changes.

### Confidence gate → `resolved` / `low_confidence` / `unresolved`
Map only when the geocoder returns a high‑confidence match (`resolved`). Store `low_confidence` matches' coordinates but treat them as non‑mappable (stylized tile) so vague places like "downtown" or "my place" never drop a confident‑looking wrong pin. The mapping from a provider's numeric confidence/relevance to these three states lives in the provider seam.
- *Alternative considered:* map anything with any coordinate. Rejected: wrong pins are worse than no pin for a "should I head out" decision.

### Reuse the app's Carto Voyager map style (FogMap); geocoder is the only keyed provider
Render with `maplibre-gl` on web reusing the **same style the mobile `FogMap.web.tsx` already ships**: a MapLibre v8 style with a Carto Voyager raster source (`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`), which is **keyless**. Apply the brand's warm treatment the way FogMap does (a light cream veil, `MIST = rgba(250,247,243,0.48)`, plus the ember marker), so the tile matches the app's neighborhood map rather than a generic basemap. Factor the shared style into one helper both surfaces import so it stays a single source of truth. This means **tiles need no provider key**; only **geocoding** (text → lat/lng) needs a provider, kept behind the `lib/pulse/geo` seam so it can be Nominatim (OSM, keyless, rate‑limited), MapTiler, or another geocoder by config.
- *Alternatives considered:* MapTiler custom vector style (nicer control, but a new keyed tile provider when the app already standardizes on Carto Voyager — rejected for consistency + zero tile key); Google Maps embed (least control, branding/cost); **static image tile** (lightest, no client JS) — kept as a drop‑in behind the same seam if the interactive map proves heavy.

### Config absence disables mapping cleanly
Tiles are keyless, so rendering needs no config. Only the geocoder may need a key: with no geocoder configured, `geocode()` is a no‑op returning `unresolved`, so every pulse renders the stylized tile with no map requests and no client errors. Any secret geocoder credential stays server‑side (geocoding runs in the create path); the client only ever loads the public Carto tiles.

## Risks / Trade-offs

- **Vague user‑typed places geocode wrongly** → confidence gate + stylized fallback; only `resolved` maps.
- **Geocoder cost / rate limits at scale** → geocode once per pulse (not per view); the geocoder is swappable behind the seam (Nominatim keyless to start, a keyed provider later). Tiles are keyless Carto Voyager, no per‑tile cost concern beyond Carto's usage policy already accepted by the mobile map.
- **Client bundle weight from `maplibre-gl`** → load the map component lazily (dynamic import) only when a resolved coordinate is present; the static‑image variant is the fallback if weight is a problem.
- **Secret leakage** → any geocoder key is used server‑side only in the create path; the client loads just the public Carto tiles, no secret reaches the bundle.
- **New dependency on web** → `maplibre-gl` is already used in the mobile workspace, so it is a known quantity, not a net‑new vendor.

## Migration Plan

1. Ship the migration adding nullable `place_lat`, `place_lng`, `place_geo_status` (default `unresolved`) to `pulse.pulses`. Backward compatible; existing rows read as `unresolved` → stylized tile.
2. Add the geocode step to creation behind config; with no geocoder configured it is a no‑op, so deploying before provisioning a geocoder changes nothing.
3. Ship the client map tile (keyless Carto Voyager) with the fallback; resolved pulses start showing maps as soon as the geocoder is configured and new pulses resolve.
4. Rollback: remove the geocoder config (mapping disables, stylized tile everywhere) and/or revert the client/create changes; the columns can remain unused.

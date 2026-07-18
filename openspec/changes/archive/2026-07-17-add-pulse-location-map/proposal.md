## Why

The pulse detail page shows a place as free text with no coordinates, so the event‑details location tile is a decorative grid rather than a real map. Attendees deciding whether to head out get no sense of where the spot actually is, and the surface's most prominent element carries no information. Resolving the free‑text place to a real, brand‑styled map makes location legible at a glance and taps through to directions.

## What Changes

- Geocode a pulse's free‑text `place` to coordinates when the pulse is created; persist `place_lat` / `place_lng` and a geocode status (`resolved` | `low_confidence` | `unresolved`) on the pulse.
- Render a real, brand‑styled map in the event‑details location tile on `/p/s/[token]` (desktop details band), centered on the resolved coordinate with a single marker, tapping through to full maps.
- Fall back to the current stylized location tile when geocoding is `unresolved` or `low_confidence` (people type vague or non‑address places). No blank or wrong‑pin maps.
- Render with MapLibre GL JS on web reusing the app's existing map style (mobile `FogMap.web.tsx`: Carto Voyager raster + warm veil), which is **keyless**; keep the geocoder behind a small config seam so only text→coordinate resolution needs a provider.
- Backfill geocoding for existing live pulses is out of scope (they keep the stylized tile); only pulses created after the change geocode.

## Capabilities

### New Capabilities
- `pulse-location-map`: resolving a pulse's free‑text place to coordinates, persisting them with a confidence status, and rendering a brand‑styled map tile (with a graceful stylized fallback) on the pulse detail surface.

### Modified Capabilities
- `pulse-broadcast`: pulse creation additionally attempts to geocode the free‑text place and persists the resulting coordinates + status; geocoding failure never blocks pulse creation.

## Impact

- **Schema**: new migration adding `place_lat`, `place_lng`, `place_geo_status` to `pulse.pulses`.
- **Create flow**: `apps/web/app/api/pulse/pulses` + `insertPulse` in `apps/web/lib/pulse/repo.ts` gain a geocode step; `serializePulse` and `PublicPulse` (`apps/web/lib/pulse/types.ts`) carry the coordinates + status through to the client.
- **UI**: `apps/web/app/p/s/[token]/Pulse.client.tsx` details tile renders a `PulseMap` component (MapLibre GL JS) when coordinates are present, else the existing `.bpd-map` stylized tile; `apps/web/app/p/pulse.css` for the map tile styling.
- **Dependencies**: add `maplibre-gl` to `apps/web` (already a mobile dependency); reuse the mobile FogMap Carto Voyager style (keyless tiles); a geocoding call (server‑side) to the chosen geocoder.
- **Config**: geocoder endpoint/key in env only; tiles are keyless. Absent geocoder → graceful no‑op (stylized tile everywhere) so local/dev without config still works.
- **Cost/alternatives**: tiles reuse the app's keyless Carto Voyager style; geocoder defaults to Nominatim/OSM (keyless) and is swappable behind the seam. A static‑image tile variant remains possible if the interactive map proves heavy. Decided in design.md.

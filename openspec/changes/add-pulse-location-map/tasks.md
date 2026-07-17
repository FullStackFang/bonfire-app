## 1. Schema

- [x] 1.1 Add migration under `supabase/migrations/` adding nullable `place_lat` (double precision), `place_lng` (double precision), and `place_geo_status` (text, default `'unresolved'`, check in `resolved` | `low_confidence` | `unresolved`) to `pulse.pulses`
- [x] 1.2 Apply locally (`supabase db reset` or push) and confirm existing rows read `unresolved` — applied to prod by the user; existing rows backfill to `unresolved`

## 2. Map style + geo seam

- [x] 2.1 Add `maplibre-gl` to `apps/web` dependencies
- [x] 2.2 Factor the map style out of mobile `FogMap.web.tsx` (Carto Voyager raster, MapLibre v8, warm `MIST` veil) into a shared helper both the mobile map and the web pulse tile import — single source of truth, keyless tiles
- [x] 2.3 Create `apps/web/lib/pulse/geo.ts`: server `geocode(place)` → `{ lat, lng, status }` using the configured geocoder, with a bounded timeout and try/catch that returns `{ status: 'unresolved' }` on any error/empty/missing‑config; map the provider's confidence to `resolved` / `low_confidence` / `unresolved` (default provider: Nominatim/OSM, keyless)
- [x] 2.4 Add geocoder config (endpoint/key) to `.env` example and config; absence makes `geocode()` a no‑op → stylized tile everywhere. Tiles are keyless, so no tile key is needed
- [x] 2.5 Unit‑test the confidence mapping and the failure/no‑config → `unresolved` path

## 3. Create flow persists coordinates

- [x] 3.1 Call `geocode(place)` in the pulse create path (`apps/web/app/api/pulse/pulses` route / `insertPulse` in `apps/web/lib/pulse/repo.ts`) and persist `place_lat` / `place_lng` / `place_geo_status`; never let a geocode failure block creation
- [x] 3.2 Extend `PublicPulse` in `apps/web/lib/pulse/types.ts` with `placeLat`, `placeLng`, `placeGeoStatus`
- [x] 3.3 Carry the fields through `serializePulse` (`apps/web/lib/pulse/serialize.ts`) and the state/read paths so the client receives them
- [x] 3.4 Test: creating a pulse records a `place_geo_status` and succeeds even when the geocoder throws/times out

## 4. Detail page map tile

- [x] 4.1 Add a `PulseMap` client component (dynamic‑imported `maplibre-gl`) using the shared FogMap/Carto Voyager style, non‑interactive, centered on the coordinate with a single ember marker and the warm veil, wrapped in a link that opens full maps
- [x] 4.2 In `apps/web/app/p/s/[token]/Pulse.client.tsx` details tile: render `PulseMap` when `placeGeoStatus === 'resolved'` and coordinates exist, else the existing `.bpd-map` stylized tile; keep identical size/placement so the band does not shift
- [x] 4.3 Style the map tile in `apps/web/app/p/pulse.css` (rounded, same footprint as the stylized tile; hide default map controls; place pill + open‑in‑maps hint overlaid)
- [x] 4.4 Honor reduced‑motion / performance: lazy‑load the map only when a resolved coordinate is present

## 5. Verify

- [x] 5.1 Extend the dev preview (`apps/web/app/p/s/preview/page.tsx`) to accept a resolved coordinate so the map tile can be reviewed without real geocoding (`?map=1` or `?lat=&lng=`)
- [x] 5.2 Manually verify in the running app: resolved place shows a styled map that taps through; unresolved/low‑confidence and no‑config both show the stylized tile; details band height is stable across states — verified via Playwright at 1440px on `/p/s/preview` (resolved: real Carto map centered on the coord + veil + ember marker + open-in-maps link; unresolved: stylized tile; band position identical between the two)
- [x] 5.3 Confirm no secret key is present in the client bundle and no map requests fire when unconfigured — `lib/pulse/geo.ts` (the only holder of any geocoder key) is imported solely by the server route; the unresolved render fired zero tile/geocode network requests
- [x] 5.4 `npm run lint:web` clean; migration applies cleanly — lint clean (0 errors); migration applied to prod cleanly

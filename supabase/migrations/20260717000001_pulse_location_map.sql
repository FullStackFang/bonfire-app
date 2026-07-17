-- Pulse location map: resolve a pulse's free-text `place` to a coordinate at creation so the
-- detail surface can render a real, brand-styled map (with a stylized fallback). Mirrors the
-- pulse schema: server-side only via the service connection; no RLS, not in realtime.

-- Geocoding is best-effort and never blocks creation, so all three columns are nullable/defaulted:
--   place_lat / place_lng  — the resolved coordinate (null when unresolved).
--   place_geo_status       — the confidence gate. Only `resolved` renders a map; `low_confidence`
--                            keeps its coordinate but is treated as non-mappable (vague places
--                            never drop a confident-looking wrong pin); `unresolved` has null
--                            coordinates. Existing rows backfill to `unresolved` -> stylized tile.
alter table pulse.pulses
  add column place_lat double precision,
  add column place_lng double precision,
  add column place_geo_status text not null default 'unresolved'
    check (place_geo_status in ('resolved', 'low_confidence', 'unresolved'));

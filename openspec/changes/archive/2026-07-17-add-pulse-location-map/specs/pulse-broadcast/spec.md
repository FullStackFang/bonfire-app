## MODIFIED Requirements

### Requirement: Pulse evolves the spark
A pulse SHALL carry the spark's shape and behavior: title/place/time_label with length caps, absolute client-resolved `expires_at`, `client_uuid` idempotency, live iff not closed and not expired, one-tap responses (`in / on_my_way / here / out`) with optional ETA and note, wrap summary, OG unfurl, and ETag polling — all carried forward unchanged under the new names (`pulses`, `pulse_responses`). `crew_id` SHALL be nullable: null is a standalone link-drop pulse; set scopes it to a crew. On creation the pulse SHALL additionally attempt to resolve its free‑text `place` to coordinates and persist `place_lat` / `place_lng` and a `place_geo_status` (`resolved` | `low_confidence` | `unresolved`); this geocoding SHALL be best‑effort and SHALL NOT block, delay past a bounded timeout, or fail pulse creation.

#### Scenario: Standalone pulse still works appless
- **WHEN** a tier-0 participant creates a standalone pulse and another tier-0 participant opens its link and taps "in"
- **THEN** the pulse is created once (idempotent on client_uuid), the response records, and no SMS is sent

#### Scenario: Creation records a geocode status
- **WHEN** a pulse is created
- **THEN** the pulse persists a `place_geo_status`, with coordinates when the place resolved and `unresolved` (null coordinates) when it did not, and creation succeeds either way

## MODIFIED Requirements

### Requirement: Place resolves to coordinates at creation

When a pulse is created, the system SHALL attempt to geocode its free‑text `place` to a coordinate and persist `place_lat`, `place_lng`, and a `place_geo_status` of `resolved`, `low_confidence`, or `unresolved`. Geocoding SHALL run off the request's critical path: the pulse SHALL be created and the creation response returned immediately with `place_geo_status = unresolved`, and the geocode result SHALL be applied asynchronously after the response, bumping the pulse `version` so polling viewers pick up the resolved map without a reload. Geocoding SHALL be best‑effort and MUST NOT block, delay, or fail pulse creation: any geocoder error, timeout, empty result, or absent provider configuration leaves the pulse `unresolved` with null coordinates. A `low_confidence` result (an ambiguous or approximate match, per the provider's confidence signal) SHALL persist its coordinates but be treated as non‑mappable downstream.

#### Scenario: A clear address resolves
- **WHEN** a pulse is created with a place the geocoder matches with high confidence
- **THEN** the pulse persists `place_lat`/`place_lng` and `place_geo_status = resolved` once the asynchronous geocode completes, and its `version` is bumped so pollers receive the update

#### Scenario: A vague place does not produce a wrong pin
- **WHEN** a pulse is created with a place the geocoder cannot match or matches only ambiguously
- **THEN** the pulse persists `place_geo_status` of `unresolved` (null coordinates) or `low_confidence`, and the pulse is created normally

#### Scenario: Geocoding never blocks creation
- **WHEN** the geocoder errors, times out, or no geocoding provider is configured
- **THEN** the pulse is still created with `place_geo_status = unresolved`, the creator sees no failure, and the creation response is not delayed by the geocoder

#### Scenario: Creation responds before the geocoder
- **WHEN** a pulse is created while the geocoder is slow (up to its full timeout)
- **THEN** the creation response returns without waiting for the geocoder, and the map (if any) arrives via a subsequent poll

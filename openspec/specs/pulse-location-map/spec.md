# pulse-location-map

## Purpose

Resolve a pulse's free-text `place` to a coordinate at creation and render a real, brand-styled map tile on the pulse detail surface when — and only when — the resolution is confident.

## Requirements

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

### Requirement: Detail page shows a real map for a resolved place

The pulse detail surface SHALL render a real, brand‑styled map in the location tile when the pulse has `place_geo_status = resolved` and coordinates. The map SHALL be centered on the coordinate with a single marker for the place, SHALL be non‑interactive enough to read at a glance (it is a tile, not an exploration surface), and tapping it SHALL open the place in full maps. Map styling SHALL follow the warm palette (cream base, ember marker) rather than a default provider style.

#### Scenario: Resolved pulse renders a map
- **WHEN** a viewer opens a pulse whose `place_geo_status` is `resolved`
- **THEN** the location tile shows a styled map centered on the coordinate with a marker, and activating the tile opens full maps for that location

#### Scenario: Map tile taps through to directions
- **WHEN** a viewer activates the map tile
- **THEN** an external maps view for the place opens in a new context (the pulse surface is not navigated away from in place)

### Requirement: Graceful fallback to the stylized tile

When a pulse is not mappable, `place_geo_status` is `unresolved` or `low_confidence`, coordinates are absent, or the map provider is not configured, the location tile SHALL render the existing stylized location tile (place name + open‑in‑maps) instead of a blank, errored, or wrongly‑pinned map. The fallback SHALL be visually consistent with the resolved tile's size and placement so the details band does not shift.

#### Scenario: Unresolved place keeps the stylized tile
- **WHEN** a viewer opens a pulse whose place is `unresolved` or `low_confidence`
- **THEN** the location tile renders the stylized place tile that links out to maps, with no empty or mis‑pinned map

#### Scenario: Missing provider config degrades cleanly
- **WHEN** no map tile/geocoding provider is configured in the environment
- **THEN** every pulse renders the stylized tile and no map requests are made

### Requirement: Map style is shared and the geocoder is a configurable seam

The map tile SHALL render with the same map style the app's neighborhood map uses (the shared Carto Voyager / MapLibre style and warm treatment), imported from one shared source so the two surfaces stay consistent; the tile style SHALL require no provider key. The geocoder SHALL sit behind a single configuration seam so it can be swapped without changing the detail UI or the creation flow, and its absence SHALL disable mapping (stylized tile everywhere) rather than break the page or leak errors to the client.

#### Scenario: Map style matches the app map
- **WHEN** a resolved pulse renders its map tile
- **THEN** it uses the shared app map style (not a separate keyed basemap), so the tile reads as the same map the neighborhood surface shows

#### Scenario: Geocoder swap does not touch UI
- **WHEN** the configured geocoder is changed via configuration
- **THEN** creation geocoding uses the new geocoder with no code change in `Pulse.client.tsx` or the create flow

#### Scenario: Keys stay server‑side
- **WHEN** the map renders
- **THEN** any secret geocoding credential is used only server‑side and is not exposed to the client bundle, and the client loads only the keyless tiles

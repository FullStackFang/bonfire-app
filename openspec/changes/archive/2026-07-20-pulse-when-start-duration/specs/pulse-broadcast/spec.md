## MODIFIED Requirements

### Requirement: Pulse evolves the spark
A pulse SHALL carry the spark's shape and behavior: title/place with length caps, a machine-resolved absolute `start_at` and end instant (`expires_at`) plus the creator's IANA `timezone`, a derived `time_label` display snapshot, `client_uuid` idempotency, live iff not closed and after its start and before its end, one-tap responses (`in / on_my_way / here / out`) with optional ETA and note, wrap summary, OG unfurl, and ETag polling — all carried forward under the names (`pulses`, `pulse_responses`). `crew_id` SHALL be nullable: null is a standalone link-drop pulse; set scopes it to a crew. On creation the pulse SHALL additionally attempt to resolve its free‑text `place` to coordinates and persist `place_lat` / `place_lng` and a `place_geo_status` (`resolved` | `low_confidence` | `unresolved`); this geocoding SHALL be best‑effort and SHALL NOT block, delay, or fail pulse creation (see pulse-location-map for the asynchronous resolution contract).

#### Scenario: Standalone pulse still works appless
- **WHEN** a tier-0 participant creates a standalone pulse and another tier-0 participant opens its link and taps "in"
- **THEN** the pulse is created once (idempotent on client_uuid), the response records, and no SMS is sent

#### Scenario: Creation records a geocode status
- **WHEN** a pulse is created
- **THEN** the pulse persists a `place_geo_status`, with coordinates when the place resolved and `unresolved` (null coordinates) when it did not, and creation succeeds either way

#### Scenario: The when label is derived, never free-typed
- **WHEN** a pulse is created with a start and duration
- **THEN** its `time_label` is derived from `start_at`/`expires_at` in the creator's `timezone` (e.g. "Now · ~2h", "Tonight 8:30pm · ~2h") and there is no free-text time field on the create form

## ADDED Requirements

### Requirement: When is a Now-or-Later start plus a duration
The create form SHALL express "when" as one control with two modes — **Now** and **Later** — plus a duration (`1h` / `2h` / `til late`), replacing the former free-text time field and the "stays live for" TTL. In **Now** mode `start_at` SHALL be the creation instant. In **Later** mode `start_at` SHALL be a creator-picked day (`Today` / `Tomorrow`) and time. In both modes `expires_at` SHALL be `start_at + duration`, where `til late` resolves to the end of the local day of `start_at`. Both instants SHALL be resolved from the creator's local wall clock (the browser's resolved IANA timezone), and that `timezone` SHALL be persisted on the pulse. The default SHALL be Now with a `2h` duration.

#### Scenario: A Now pulse starts immediately
- **WHEN** a creator drops a pulse in Now mode with a `2h` duration
- **THEN** `start_at` is the creation instant, `expires_at` is two hours later, and the pulse is live immediately

#### Scenario: A Later pulse is scheduled and shareable before it starts
- **WHEN** a creator drops a pulse in Later mode for Today at 8:30pm running `2h`
- **THEN** `start_at` is 8:30pm and `expires_at` is 10:30pm in the creator's timezone, and the pulse link is shareable and can collect responses before 8:30pm

#### Scenario: A past start is refused
- **WHEN** a creator in Later mode picks a Today time that has already passed
- **THEN** creation is refused with an inline nudge and the drop action stays disabled until `start_at` is in the future

### Requirement: A pulse's lifecycle is upcoming, live, or over
A pulse SHALL have exactly one phase for a given `now`: **upcoming** when `now < start_at`, **live** when `start_at <= now < expires_at`, and **over** when `now >= expires_at` or `closed_at` is set. A pulse SHALL auto-wrap into the over phase at `expires_at` with no cron, timer, or manual action — it simply drops out of every live list once `now >= expires_at`. Only a live or upcoming pulse SHALL accept responses; an over pulse SHALL reject them.

#### Scenario: A pulse ends itself at its end instant
- **WHEN** an unclosed pulse's `expires_at` passes with no one taking any action
- **THEN** the pulse is over: it leaves every live list and stops accepting responses, with no wrap tap required

#### Scenario: Upcoming pulse collects intent, then goes live
- **WHEN** a viewer opens an upcoming pulse and taps "in", then reloads after `start_at` passes
- **THEN** the "in" response is recorded while upcoming, and after `start_at` the same pulse renders as live

### Requirement: Manual wrap ends a pulse early and cannot be triggered by a status tap
The manual wrap SHALL exist only to end a pulse **before** its `expires_at`. Its authorization SHALL be unchanged from v1 (anyone with the link may wrap; no host role is introduced). The wrap control SHALL NOT sit within or adjacent to the personal status ("here") region, and SHALL require an explicit confirm, so that changing one's own status — including reaching "here" — can never end the pulse for everyone. Wrapping SHALL remain idempotent and SHALL still return the made-it summary.

#### Scenario: Reaching "here" never ends the event
- **WHEN** a participant drags or taps their status to "here"
- **THEN** their status updates to here and the pulse remains live — no wrap occurs

#### Scenario: Ending early takes a deliberate confirm
- **WHEN** a viewer chooses "End early" and confirms
- **THEN** the pulse closes (over), further responses are rejected, and the made-it summary returns; a single stray tap without the confirm does not close it

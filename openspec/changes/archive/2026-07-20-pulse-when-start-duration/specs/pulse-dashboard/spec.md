## MODIFIED Requirements

### Requirement: Liveness split follows the pulse lifecycle
The dashboard SHALL classify a pulse as active iff `closed_at is null` and `expires_at > now` — spanning both **upcoming** (`now < start_at`) and **live** (`start_at <= now < expires_at`) pulses — and SHALL render them in the active ("Live now") section ordered by soonest `start_at` first, so what is next to happen leads. An upcoming card SHALL show its start label rather than a live countdown. Over pulses (`now >= expires_at`) or wrapped pulses (`closed_at` set) SHALL appear under "Earlier", most recent first, capped at a fixed limit; older items simply fall off.

#### Scenario: A wrap moves the pulse to Earlier
- **WHEN** a pulse the viewer responded to is wrapped and the viewer reloads `/p`
- **THEN** it no longer appears under "Live now" and appears under "Earlier"

#### Scenario: An upcoming pulse shows in the active section with its start
- **WHEN** a viewer opens `/p` with a Later pulse that starts in two hours
- **THEN** the pulse appears in the active section, ordered by its start, showing its start label rather than a "live for another N min" countdown

#### Scenario: A pulse past its end falls to Earlier without a wrap
- **WHEN** a viewer reloads `/p` after one of their active pulses passes `expires_at` with no wrap tap
- **THEN** that pulse leaves the active section and appears under "Earlier"

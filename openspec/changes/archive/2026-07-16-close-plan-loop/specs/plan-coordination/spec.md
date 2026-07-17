# plan-coordination (delta)

## ADDED Requirements

### Requirement: The deadline resolves the plan instead of killing it
The app SHALL, when a plan's `closes_at` passes while the plan is `open`, resolve it: if at least one availability selection exists on any option, the plan SHALL strike on the option with the most availability (ties broken by earliest start time, then option rank), through the same atomic, idempotent transition as a threshold strike. A plan SHALL move to `expired` only when `closes_at` passes with no selections on any option. The deadline outcome SHALL be stated in the house voice ("locked in at the deadline") with no blame surface for anyone.

#### Scenario: Deadline strikes the best option
- **WHEN** `closes_at` passes on an open plan where some participants marked availability
- **THEN** the plan strikes on the option with the most availability and reads "it's on" with the winning time and place

#### Scenario: Tie broken by earliest time
- **WHEN** the deadline passes with two options tied on availability count
- **THEN** the option with the earlier start time is struck

#### Scenario: Expiry now means nobody engaged
- **WHEN** `closes_at` passes on an open plan with zero selections on every option
- **THEN** the plan moves to `expired`

#### Scenario: Deadline resolution is race-safe
- **WHEN** a threshold-crossing selection and the deadline resolution occur at nearly the same time
- **THEN** the plan strikes exactly once on a single winning option

### Requirement: A struck plan completes after it happens
The app SHALL transition a `struck` plan to `completed` once the gathering has plausibly ended — the winning option's start time plus a buffer has passed, or a fallback interval after the strike when the winning option carries no time. The transition SHALL be applied lazily and idempotently when the plan is read (no background job required), and `completed` plans SHALL remain reachable at their link and on the opener's Pulse surface.

#### Scenario: Plan completes after the winning time passes
- **WHEN** a struck plan is read after its winning option's start time plus the buffer has passed
- **THEN** the plan is `completed` and its link renders the post-event view

#### Scenario: Timeless winner falls back to strike time
- **WHEN** a struck plan's winning option has no parseable time and the fallback interval after the strike has passed
- **THEN** the plan is `completed`

#### Scenario: Completion is idempotent under concurrent reads
- **WHEN** two reads of the same due plan race
- **THEN** the plan transitions to `completed` exactly once

# availability

## Purpose

The coarse availability engine: a standing baseline declared once, exceptions that override it, and a pure resolution function. Passive by design — nothing in this capability ever notifies anyone.

## Requirements

### Requirement: Baseline declared once
A verified participant SHALL be able to declare one or more recurring busy windows (`days_of_week` 0–6, `start_time`, `end_time`, optional label ≤40 chars), each stored with the IANA timezone captured from the browser at creation. Onboarding SHALL ask exactly one question ("When are you usually tied up?"), SHALL be skippable, and SHALL NOT present a full recurring-schedule editor.

#### Scenario: Declaring a work baseline
- **WHEN** a verified participant declares Mon–Thu 09:00–17:30 labeled "work"
- **THEN** one baseline row is stored with those days, times, label, and the browser's timezone

#### Scenario: Skipping onboarding
- **WHEN** a participant skips the onboarding question
- **THEN** no baseline rows are created and the participant's availability resolves as `unknown`

### Requirement: Exceptions override the baseline
A verified participant SHALL be able to record a one-off correction with `state` (`free` | `busy`), an absolute start/end (range support for multi-day, `all_day` flag), and an optional label. Exceptions SHALL always take precedence over the baseline within their window. The correction flow SHALL confirm with a silent toast only.

#### Scenario: Free exception over a busy baseline
- **WHEN** a participant whose baseline marks Thursday evening busy records "I'm free" for that Thursday evening
- **THEN** their availability for that window resolves as `free` with `low` confidence

#### Scenario: Vacation range
- **WHEN** a participant records an all-day `busy` exception labeled "vacation" spanning next Monday through Friday
- **THEN** every window within that range resolves as `busy` with label "vacation", regardless of the baseline

### Requirement: Resolution order and confidence
`resolveAvailability` SHALL be a pure function returning `{availability: free | probably_free | busy | unknown, confidence: high | low, label?}` and SHALL resolve in this order: (1) calendar busy-blocks when a `calendar_source` exists (high confidence — stub in v1, always falls through); (2) overlapping exceptions (busy → `busy` with label; free → `free` at `low` confidence); (3) baseline overlap in the baseline's stored timezone (`busy` with label); (4) no overlap → `probably_free` at `low` confidence; (5) nothing declared and no calendar → `unknown`.

#### Scenario: Baseline busy window
- **WHEN** availability is resolved for a window overlapping a "work" baseline window and no exceptions apply
- **THEN** the result is `busy` with label "work"

#### Scenario: Outside all busy windows
- **WHEN** availability is resolved for a window overlapping no baseline windows and no exceptions
- **THEN** the result is `probably_free` with `low` confidence

#### Scenario: Nothing declared
- **WHEN** availability is resolved for a participant with no baseline, no exceptions, and no calendar source
- **THEN** the result is `unknown`

#### Scenario: Midnight-spanning baseline window
- **WHEN** a baseline window crosses midnight (e.g. 22:00–02:00) and availability is resolved for a window at 01:00 on the following day-of-week
- **THEN** the window is treated as busy per the declared timezone

### Requirement: Unknown never blocks and never reads as a no
The `unknown` state SHALL never prevent any flow from proceeding and SHALL never be rendered or counted as a decline or non-answer in any group-facing surface.

#### Scenario: Unknown member in a group view
- **WHEN** a group surface renders a member whose availability is `unknown`
- **THEN** the member appears in the neutral-outline unknown style and is not counted toward or framed as any negative tally

### Requirement: Availability changes are silent
No write to `availability_baseline` or `availability_exception` SHALL trigger any notification (SMS, push, or otherwise) to anyone.

#### Scenario: Correction sends nothing
- **WHEN** a participant records an "I'm away" exception
- **THEN** no SMS is sent, no delivery row is written, and no other participant is notified by any channel

### Requirement: Availability color semantics
Everywhere availability renders, the system SHALL use: solid green for `free` (high confidence), amber/lighter weight for `probably_free`, muted grey plus label for `busy`, neutral outline for `unknown`. Coral SHALL be reserved for actions and the pulse flare, never an availability state.

#### Scenario: Rendering a probably-free member
- **WHEN** a member resolving to `probably_free` is rendered in any availability surface
- **THEN** they render in the amber/lighter-weight style, not solid green and not coral

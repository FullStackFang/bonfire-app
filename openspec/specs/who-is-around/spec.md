# who-is-around

## Purpose

The ambient discovery surface: a pull-only glance at which crew members are free in a window. Fires nothing.

## Requirements

### Requirement: Pull-only ambient view
Each crew SHALL have a Who's-Around view that, for a chosen window (tonight / this weekend / custom), resolves availability for every crew member and renders it. Loading or refreshing the view SHALL fire no notification of any kind and SHALL write nothing except a funnel event.

#### Scenario: Glancing fires nothing
- **WHEN** a member opens Who's-Around for this weekend
- **THEN** every member's resolved availability renders, exactly one `around_view` funnel event is written, and no SMS or other notification is sent to anyone

### Requirement: Rendering order and framing
The view SHALL render `free`/`probably_free` members first (green/amber per the availability color semantics), then `unknown` members in the neutral-outline style, then `busy` members muted with their label. Live board presence, when present, SHALL be merged into a member's row. No grouping, count, or copy SHALL frame unknown or busy members as decliners or laggards.

#### Scenario: Mixed crew renders in order
- **WHEN** a crew resolves to two probably-free members, one unknown, and one busy-"work"
- **THEN** the probably-free members render first in amber, the unknown member renders in neutral outline, and the busy member renders muted with "work" — with no negative tally anywhere

### Requirement: Glance-to-action handoff
Tapping a free or probably-free member SHALL offer "drop a pulse" (routing into the pulse compose flow). The handoff itself SHALL send nothing.

#### Scenario: Tap leads to compose, not to contact
- **WHEN** a member taps a probably-free person and chooses "drop a pulse"
- **THEN** the pulse composer opens scoped to the crew and no message is sent until the composer's own delivery step completes

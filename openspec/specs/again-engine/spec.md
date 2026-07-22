# again-engine

## Purpose

Capture recurrence intent after a gathering happens — the SYSTEM-THESIS §iv "again" engine. When a plan completes, attendees see a two-zone afterglow screen: the primary "do this again?" control, whose taps accumulate on an **ember** (the per-plan recurrence object), and the tappable co-attendee faces (person intents; see `person-intent`). Both follow strict mutual-visibility rules — silence is invisible, one-sided interest is never exposed. A mutual ember can seed the next plan through the plan-coordination engine.

## Requirements

### Requirement: Completed plan shows the afterglow screen
The app SHALL render a post-event view at `/p/plan/[token]` when a plan is `completed`, composed of exactly two zones: a warm one-line statement of what happened (winning time/place, house voice) with the primary control — "do this again?" — and, below it, the faces of the plan's attendees (winning-option markers, excluding the viewer), each tappable as a person intent (see `person-intent`). Zone one SHALL remain visually primary. The view SHALL be available to every participant who marked the plan's winning option, including tier-0 no-account participants, and SHALL present no controls beyond the two zones: no roster of who has or hasn't responded (to the plan, the ember, or any person intent), no feedback form, no decline control. Each face SHALL carry only the viewer's own tap state and any mutual reveal permitted by the person-intent visibility rules — never another participant's one-sided state.

#### Scenario: Attendee opens the link after the event
- **WHEN** a participant who marked the winning option opens `/p/plan/[token]` and the plan is `completed`
- **THEN** they see the afterglow view with the "do this again?" control and the tappable faces of their co-attendees

#### Scenario: Tier-0 participant is eligible
- **WHEN** a no-account participant who marked the winning option opens the completed plan link
- **THEN** they see the same two-zone afterglow view and can tap either zone, with no sign-in required

#### Scenario: Non-attendee sees no tap control
- **WHEN** a participant who did not mark the winning option opens the completed plan
- **THEN** they see the plan's outcome but neither the "do this again?" control nor tappable faces

#### Scenario: Faces never reveal others' intent state
- **WHEN** the afterglow view renders its faces for a viewer
- **THEN** each face shows at most the viewer's own tap state and mutual reveals — never whether anyone else has tapped anyone

### Requirement: A tap creates or joins the plan's ember
The app SHALL, on a participant's "again" tap, create the plan's ember if none exists (snapshotting the plan's intent/activity) and record the participant's tap. Taps SHALL be idempotent per participant, scoped to that plan's gathering (never a global or cross-gathering signal), and SHALL be removable by their author.

#### Scenario: First tap creates the ember
- **WHEN** the first eligible participant taps "do this again?"
- **THEN** an ember is created for that plan carrying its intent, with that participant's tap recorded

#### Scenario: Tapping twice records once
- **WHEN** a participant taps "again" a second time on the same plan
- **THEN** their tap is recorded exactly once

#### Scenario: A tap can be withdrawn
- **WHEN** a tapper removes their tap
- **THEN** the tap is deleted, and if fewer than two taps remain the ember reverts to non-mutual visibility rules

### Requirement: Silence is invisible and one-sided interest is never exposed
The app SHALL never reveal, on any surface or API response, which eligible participants have not tapped. A non-mutual ember (fewer than two taps) SHALL be visible only to its own tapper, showing only their own standing tap — never other participants' absence of one. Co-tapper names SHALL be revealed only once the ember is mutual (two or more taps), and only to tappers.

#### Scenario: Solo tapper sees only themselves
- **WHEN** exactly one participant has tapped and they view the ember
- **THEN** they see their own standing intent ("you're in for another one") and no information about anyone else

#### Scenario: Non-tappers see nothing of the ember
- **WHEN** an eligible participant who has not tapped views the completed plan
- **THEN** no ember state, tap count, or tapper name is shown to them

#### Scenario: Mutuality reveals co-tappers to tappers only
- **WHEN** a second participant taps
- **THEN** each tapper now sees the other tappers credited by name, while non-tappers still see nothing

#### Scenario: The API never lists the untapped
- **WHEN** any client requests ember data
- **THEN** the response contains only tappers (subject to mutuality rules), never eligible-but-untapped participants

### Requirement: A mutual ember can seed the next plan
The app SHALL let any tapper on a mutual ember start the next gathering: one action creates a new plan through the plan-coordination engine with intent pre-seeded from the ember's snapshot and co-tapper names, owned by the initiating tapper. The app SHALL NOT message anyone — the new plan's link is shared by the initiator, the same explicit-share flow as any plan.

#### Scenario: Start the next one
- **WHEN** a tapper on a mutual ember chooses to start the next one
- **THEN** a new plan is created via the plan proposer, pre-seeded from the ember's intent and people, and the initiator lands on it to review and share

#### Scenario: No silent messaging
- **WHEN** a plan is seeded from an ember
- **THEN** nothing is sent to any other tapper until the initiator shares the link themselves

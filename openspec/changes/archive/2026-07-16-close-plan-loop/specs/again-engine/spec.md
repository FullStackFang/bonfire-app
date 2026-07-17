# again-engine (delta)

## ADDED Requirements

### Requirement: Completed plan shows the afterglow screen
The app SHALL render a post-event view at `/p/plan/[token]` when a plan is `completed`: a warm one-line statement of what happened (winning time/place, house voice) and a single control — "do this again?". The view SHALL be available to every participant who marked the plan's winning option, including tier-0 no-account participants, and SHALL present no other controls: no roster of who has or hasn't responded, no feedback form, no decline control.

#### Scenario: Attendee opens the link after the event
- **WHEN** a participant who marked the winning option opens `/p/plan/[token]` and the plan is `completed`
- **THEN** they see the afterglow view with the single "do this again?" control

#### Scenario: Tier-0 participant is eligible
- **WHEN** a no-account participant who marked the winning option opens the completed plan link
- **THEN** they see the same afterglow view and can tap, with no sign-in required

#### Scenario: Non-attendee sees no tap control
- **WHEN** a participant who did not mark the winning option opens the completed plan
- **THEN** they see the plan's outcome but no "do this again?" control

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

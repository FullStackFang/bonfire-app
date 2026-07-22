# again-engine (delta)

## MODIFIED Requirements

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

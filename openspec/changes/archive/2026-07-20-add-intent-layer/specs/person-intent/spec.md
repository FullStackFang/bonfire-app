# person-intent

## ADDED Requirements

### Requirement: A person intent is one tap toward a co-attendee
The app SHALL let a participant register a person intent — "I want to see them again" — as a single tap on a co-attendee's face in the afterglow view of a completed plan. A tap `A → B` SHALL be valid only when both A and B marked the plan's winning option (the same attendance proxy as ember taps), including tier-0 no-account participants. The stored object SHALL be exactly `{from, to, source_plan, timestamp}` with no user-facing fields — no intensity, notes, or categories.

#### Scenario: Tapping a face registers the intent
- **WHEN** an eligible attendee taps a co-attendee's face in the afterglow view
- **THEN** one person-intent row is stored from the tapper toward that person, with no further input requested

#### Scenario: Tier-0 participant can tap
- **WHEN** a no-account participant who marked the winning option taps a co-attendee's face
- **THEN** the intent is recorded against their existing per-link participant identity, no sign-in required

#### Scenario: No path to non-attendees
- **WHEN** the afterglow view renders its tappable faces
- **THEN** only participants who marked the winning option appear — there is no control for registering intent toward anyone else

### Requirement: Person intents are pair-scoped, idempotent, and withdrawable
The app SHALL store at most one intent per directed pair. Re-tapping the same person — from the same or any later gathering — SHALL record nothing new and preserve the original timestamp. The author SHALL be able to withdraw their intent, and withdrawal SHALL revert any mutual reveal on both sides.

#### Scenario: Re-tap from a later gathering records once
- **WHEN** a participant who already has a standing intent toward someone taps them again after another shared gathering
- **THEN** exactly one row exists for that directed pair, with the original timestamp

#### Scenario: Withdrawal reverts the reveal
- **WHEN** a participant withdraws their intent from a mutual pair
- **THEN** the row is deleted and neither side sees a mutual reveal any longer

### Requirement: One-sided intent is never exposed and silence is invisible
The app SHALL reveal a person intent to no one but its author until the pair is mutual (both directed rows exist). A one-sided intent SHALL render only to its author as their own standing tap; the recipient SHALL see nothing, and an unreciprocated tap SHALL be indistinguishable from silence on every surface and in every API response, indefinitely. No surface SHALL show who has not tapped, tap counts toward the viewer, or tap timestamps.

#### Scenario: Recipient of a one-sided intent sees nothing
- **WHEN** A has tapped B and B has not tapped A, and B views any surface
- **THEN** B sees no trace of A's intent — no hint, count, or state distinguishable from A never having tapped

#### Scenario: Author sees only their own standing tap
- **WHEN** A has tapped B and views the afterglow or any intent surface
- **THEN** A sees their own tap as standing (and can withdraw it), with no information about B's state

#### Scenario: The API never leaks one-sided rows
- **WHEN** any client requests intent data for a viewer
- **THEN** the response contains only the viewer's own intents and mutual pairs — never one-sided intents toward the viewer, never other participants' one-sided intents

### Requirement: Mutuality reveals symmetrically
When both directed rows of a pair exist, the app SHALL reveal the match to both participants identically — framed as "you both wanted this" — never as one side having asked first or the other agreeing. Tap order and timestamps SHALL never be displayed.

#### Scenario: Second tap completes the pair
- **WHEN** B taps A while A's intent toward B is standing
- **THEN** both A and B can now see the mutual match, each framed symmetrically, with no indication of who tapped first

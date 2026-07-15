# crews

The durable crew object, evolved from the Live Pulse container: same token/link/presence-board behavior, plus an explicit membership roster gated on the phone tier.

## ADDED Requirements

### Requirement: Crew evolves the container
A crew SHALL carry the container's shape and behavior: unique share token, name (≤60 chars), monotonic `version` bumped on every crew-affecting write, OG unfurl, and the current-only presence board (`around/busy/away/out` + optional note ≤80 chars) usable by tier-0 participants. Existing container behavior (ETag polling, rate limits, no absent/silent list) SHALL carry forward unchanged under the new name.

#### Scenario: Board presence still works appless
- **WHEN** a tier-0 participant opens a crew link and sets status "around" with a note
- **THEN** the presence upsert succeeds, the crew version bumps, and other viewers see it via polling within a few seconds

### Requirement: Explicit membership roster
The system SHALL maintain `crew_members` (crew, participant, joined_at). Creating a crew SHALL require a verified phone and SHALL add the creator as a member. Joining a crew SHALL be an explicit act by a verified participant on the crew page. The roster is the scope for SMS delivery and Who's-Around.

#### Scenario: Verified participant joins a crew
- **WHEN** a verified participant taps "join" on a crew page
- **THEN** a `crew_members` row is created and they subsequently appear in the crew's Who's-Around view

#### Scenario: Tier-0 participant tries to join
- **WHEN** a participant with no verified phone taps "join"
- **THEN** the join is rejected pending phone verification, while their ability to view the crew and set board presence is unaffected

### Requirement: Membership is never a rejection surface
Leaving a crew SHALL be a quiet single act by the member. The system SHALL NOT notify the crew when someone joins or leaves, and SHALL NOT render any list framing members negatively (no "hasn't joined", no "left" feed).

#### Scenario: Member leaves quietly
- **WHEN** a member leaves a crew
- **THEN** their roster row is removed, no notification of any kind is sent, and no leave event is rendered to other members

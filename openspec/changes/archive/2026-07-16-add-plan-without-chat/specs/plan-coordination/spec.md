# plan-coordination

## ADDED Requirements

### Requirement: State intent to start a plan
The web app SHALL let a signed-in or tier-0 participant start a plan by expressing intent in free text (typed or spoken), with no requirement to pre-select a time, place, or invitee list. Submitting intent SHALL create a `plan` in the `proposing` state owned by that participant and advance to proposed options. Intent text SHALL be treated as untrusted input and never executed as instructions by the proposer.

#### Scenario: Opener types an intent
- **WHEN** a participant enters "Dinner with Sarah and Mike next week" and continues
- **THEN** a plan is created owned by that participant and the app advances to the proposed options

#### Scenario: Intent alone is enough
- **WHEN** a participant submits intent without choosing any time or place
- **THEN** the plan is still created and the proposer runs — no time/place field is required of the opener

### Requirement: AI proposes candidate options
The app SHALL, on plan creation, generate a small ranked set of candidate options (times and/or places) from the intent plus available context (the opener's known people, past venues, coarse locale), returned as validated structured data — never free prose parsed at runtime. Each option SHALL carry its time and/or place and a short rationale. If generation fails, the app SHALL fall back to a deterministic default set drawn from context so plan creation never hard-fails.

#### Scenario: Options are proposed
- **WHEN** a plan is created from an intent
- **THEN** the opener sees a short ranked list of candidate times and a short list of candidate places, each with a one-line reason

#### Scenario: Proposer failure degrades gracefully
- **WHEN** option generation errors or times out
- **THEN** the plan is still created and shows a small set of sensible default options rather than an error

### Requirement: Opener confirms the shareable plan
The app SHALL let the opener accept or adjust the proposed options and then produce a per-plan shareable link. Producing the link SHALL move the plan to the `open` state and mint a unique per-plan token addressing `/p/plan/[token]`. Copy SHALL follow the house voice — statements not questions, sentence case, credit the opener by name, no RSVP language, no exclamation hype.

#### Scenario: Opener publishes the plan
- **WHEN** the opener taps "looks good" on the proposed options
- **THEN** the plan moves to `open` and a unique `/p/plan/[token]` link is available to share

### Requirement: The plan link opens to value without an account
The app SHALL render the plan at `/p/plan/[token]` to any visitor with the link, with no account, sign-in, or app install required to view it or to make a selection. A visitor interacting for the first time SHALL be attached to a tier-0 participant (minted transparently); phone verification SHALL be offered only as an optional upgrade for a durable identity or updates, never as a gate. The link SHALL provide a rich unfurl (Open Graph image + metadata) when pasted into a chat.

#### Scenario: A friend opens the link with no account
- **WHEN** a person opens `/p/plan/[token]` for the first time
- **THEN** they see the plan and can make a selection without signing in or installing anything

#### Scenario: Link unfurls in a group chat
- **WHEN** the link is pasted into a chat that renders Open Graph previews
- **THEN** it shows a Bonfire-branded card naming the opener and the plan, not a bare URL

#### Scenario: Verification is optional, never required
- **WHEN** a visitor makes a selection
- **THEN** the selection is recorded under a tier-0 identity and phone verification is offered but not required

### Requirement: Invitees mark their availability across the options
The app SHALL let a plan visitor mark **which of the proposed options they are available for** and send it. Selection SHALL be framed as availability ("when you're free"), never as attendance, RSVP, or Going/Maybe/Can't. The UI SHALL NOT present a "can't make any" / decline control — declining is expressed by silence, never a rejection surface. Selections SHALL be recorded per participant, and absence SHALL never be displayed as an out-list, decline, or flake record. Once an option is locked as the plan's winner, a visitor MAY declare presence at it as a plain statement ("I'm in") — still never a question. (Resolution of conflict C1 → **C1-C hybrid**, `design/growth-story/conflicts.md`.)

#### Scenario: Invitee marks availability
- **WHEN** a visitor taps the proposed times they are free for and sends
- **THEN** their availability is recorded against those options and they see a warm confirmation crediting them by name ("thanks, Sarah")

#### Scenario: No decline control is offered
- **WHEN** a visitor views the selection UI
- **THEN** there is no "can't make any", "decline", or Going/Maybe/Can't control — a non-response is simply no availability marked

#### Scenario: No shaming of non-participants
- **WHEN** the plan is viewed after some people have marked availability and others have not
- **THEN** no out-list, decline roster, or flake record is shown for anyone

#### Scenario: Presence at the locked plan is a statement
- **WHEN** an option has been locked as the winner and a visitor confirms they are coming
- **THEN** they declare "I'm in" as a plain statement, with no Going/Maybe/Can't options presented

### Requirement: The plan confirms when enough people are in
The app SHALL flip a plan to `struck` (confirmed) when selections for an option reach the plan's confirmation threshold, recording the winning option. The transition SHALL be atomic and idempotent (concurrent selections MUST NOT double-strike or confirm two options). On confirmation the plan SHALL surface as "it's on" to the opener and on the link view, stated with the winning time and place and who's in, in the house voice — no SMS broadcast is sent by this change.

#### Scenario: Threshold reached confirms the plan
- **WHEN** selections for a candidate option reach the confirmation threshold
- **THEN** the plan moves to `struck`, that option is locked as the winner, and the plan reads "it's on" with the time, place, and who's in

#### Scenario: Confirmation is idempotent under concurrent selections
- **WHEN** two selections that both cross the threshold arrive at nearly the same time
- **THEN** the plan strikes exactly once on a single winning option

#### Scenario: Confirmed plan is reachable from the opener's surface
- **WHEN** a plan is confirmed
- **THEN** the opener sees the confirmed plan on their Pulse surface and can add it to a calendar

# plan-coordination

## Purpose

Make a plan without the group chat: one person states intent, an AI proposes candidate options, friends open a no-account link and mark which they're free for (availability, never RSVP), and the plan confirms ("it's on") when enough are in. The web Pulse rail surface of growth-story Phase 1.

## Requirements

### Requirement: State intent to start a plan
The web app SHALL let a signed-in or tier-0 participant start a plan by expressing intent in free text (typed or spoken), with no requirement to pre-select a time, place, or invitee list. Submitting intent SHALL create a `plan` in the `proposing` state owned by that participant and advance to proposed options. Intent text SHALL be treated as untrusted input and never executed as instructions by the proposer.

#### Scenario: Opener types an intent
- **WHEN** a participant enters "Dinner with Sarah and Mike next week" and continues
- **THEN** a plan is created owned by that participant and the app advances to the proposed options

#### Scenario: Intent alone is enough
- **WHEN** a participant submits intent without choosing any time or place
- **THEN** the plan is still created and the proposer runs — no time/place field is required of the opener

### Requirement: AI proposes candidate options
The app SHALL, on plan creation, generate a small ranked set of candidate options (times and/or places) from the intent plus available context (the opener's known people, past venues, coarse locale), returned as validated structured data — never free prose parsed at runtime. Each option SHALL carry its time and/or place and a short rationale. The model SHALL be reached through a configurable model gateway (a `provider/model` selection resolved from configuration, not hardcoded), so the provider or model can change without a code change. Generation SHALL degrade to a deterministic default set drawn from context — never a hard failure of plan creation — when any of the following occur: no gateway credential is available, the gateway or provider errors or times out, a spend/budget limit is reached, or a rate limit is hit.

#### Scenario: Options are proposed
- **WHEN** a plan is created from an intent and a gateway credential is available
- **THEN** the opener sees a short ranked list of candidate options, each with a time and/or place and a one-line reason

#### Scenario: No gateway credential configured
- **WHEN** a plan is created and no gateway credential (API key or platform OIDC token) is present
- **THEN** the plan is still created and shows a small set of sensible default options — the gateway is never called

#### Scenario: Proposer failure degrades gracefully
- **WHEN** option generation errors or times out
- **THEN** the plan is still created and shows deterministic default options rather than an error

#### Scenario: Budget or rate limit degrades gracefully
- **WHEN** the gateway reports a spend/budget limit (402) or a rate limit (429)
- **THEN** the plan is still created with deterministic default options, and no error surfaces to the opener

#### Scenario: Model is selected by configuration
- **WHEN** the configured model is changed (a different gateway `provider/model` slug)
- **THEN** subsequent proposals use the new model with no code change

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

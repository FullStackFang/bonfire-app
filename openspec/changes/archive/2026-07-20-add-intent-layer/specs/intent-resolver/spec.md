# intent-resolver

## ADDED Requirements

### Requirement: Candidates are derived at read time
The app SHALL compute draft-plan candidates for a viewer as a pure read-time resolution over three inputs — the viewer's mutual embers, their mutual person intents, and availability (`resolveAvailability`) for the people involved — with no materialized candidate state, no cron, and no timers. A stored intent that never matches SHALL cost nothing and trigger nothing: no row is created, no age-based nudge ever fires from an intent alone.

#### Scenario: Unmatched intents produce nothing
- **WHEN** a viewer has only one-sided person intents and no mutual embers
- **THEN** the resolver returns no candidates and no state is written anywhere

#### Scenario: No timer on a stored intent
- **WHEN** an intent has sat unmatched for any length of time
- **THEN** no surface or message references its age — the intent is a seed, not a timer

### Requirement: Compound matches rank highest
The app SHALL rank candidates: a compound match (a mutual ember whose co-tappers include a mutual person-intent partner of the viewer) above a mutual ember alone, above a mutual person intent alone. Within a tier, candidates with a resolved availability overlap SHALL rank above those without, and `unknown` availability SHALL never exclude or demote a candidate to nothing. Each candidate SHALL carry the people involved, a seed intent (the ember's snapshot when present; the pair alone otherwise), and the suggested window when availability resolved one.

#### Scenario: The compound case wins
- **WHEN** the viewer and Kat both tapped "again" on a completed climbing plan and also hold a mutual person intent for each other
- **THEN** the resolver returns one candidate — climbing with Kat — ranked above any single-signal candidate, not two separate candidates

#### Scenario: Person-intent-only candidate has no activity seed
- **WHEN** a mutual person intent exists with no shared mutual ember
- **THEN** the candidate seeds only the pair (like a reconnect suggestion), leaving the activity to the plan proposer

#### Scenario: Unknown availability does not block
- **WHEN** a mutual match exists but availability for the other person resolves `unknown`
- **THEN** the candidate still appears, without a suggested window, and is never framed as the person being unavailable

### Requirement: Candidates speak through defaults, never displayed facts
Per `campfire-knowledge`, a candidate SHALL surface only what the viewer already co-owns — the mutual signal (the people, the shared activity) — plus system-chosen defaults (a suggested window, a ranked position). It SHALL NOT state observed facts about another person as the reason: never "Kat is free Thursday", never an availability state, rhythm, or preference attributed to a person. The suggested window simply *is* Thursday; the ranking simply *is* right. Availability inputs are felt as good timing, not read as data.

#### Scenario: A window is suggested without naming availability
- **WHEN** a candidate's suggested window came from an availability overlap
- **THEN** the card offers the window as a default and nowhere states or colors the other person's availability as a fact about them

#### Scenario: No reasons panel
- **WHEN** a viewer inspects a candidate
- **THEN** no surface explains what the system knows about the people involved — the candidate shows only the mutual signal and the draft defaults

### Requirement: Surfacing is pull-only
The app SHALL surface resolver candidates only on existing viewer-initiated surfaces (the dashboard card). No intent write, mutual match, or candidate SHALL generate a notification, SMS, push, or delivery row. The mutual-reveal moment SHALL occur when a participant next views a surface that renders it.

#### Scenario: A fresh mutual match sends nothing
- **WHEN** a second tap completes a mutual pair or a compound match becomes resolvable
- **THEN** no message of any kind is sent to anyone; each party discovers it on their next visit

### Requirement: Accepting a candidate drafts a plan, never messages silently
When the viewer accepts a candidate, the app SHALL create a plan through the plan-coordination proposer — pre-seeded with the candidate's people, seed intent, and suggested window when present — owned by the viewer, who lands on it to review and share. The app SHALL NOT message anyone; the plan row SHALL be created only at acceptance, and sharing the link is the viewer's explicit action, the same flow as ember-seeding and reconnect.

#### Scenario: Accept lands on a reviewable plan
- **WHEN** the viewer accepts a compound candidate
- **THEN** a plan is created via the proposer seeded from the ember's intent and the people involved, and the viewer lands on it to review and share

#### Scenario: Nothing materializes before acceptance
- **WHEN** the resolver returns candidates the viewer never acts on
- **THEN** no plan or draft row exists for them in the database

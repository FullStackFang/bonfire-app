# relationship-intelligence

## Purpose

Proactively notice crew relationships going stale and offer to reconnect — a co-presence recency signal derived from real in-app activity (never a scraped address book), surfaced as an opt-in, frequency-capped dashboard card that turns "yes" into a plan via the plan-coordination engine. Growth-story Phase 3, on the web Pulse rail.

## Requirements

### Requirement: Co-presence recency from real activity
The app SHALL derive, for the viewer, how long it has been since they were last actually together with each crew-mate, computed only from in-app co-presence — plans that struck and both attended (both marked the winning option) — never from imported or scored address-book contacts. A recency value SHALL exist only for people the viewer has co-attended a plan with; a crew-mate with no co-attendance SHALL surface as "not yet gotten together" rather than a number.

#### Scenario: Recency reflects real co-presence
- **WHEN** the viewer and a crew-mate last struck and attended a plan some days ago
- **THEN** the app can report that elapsed time ("you haven't seen X in N days")

#### Scenario: No recency for non-co-present contacts
- **WHEN** a person is a contact but the viewer has never co-attended a plan with them
- **THEN** no recency signal is produced — the app does not score the address book

#### Scenario: Never-together surfaces without a number
- **WHEN** the viewer shares a crew with someone but has never co-attended a plan with them
- **THEN** they may surface as "haven't gotten together yet", not as a days count

### Requirement: Proactive suggestions are opt-in and frequency-capped
The app SHALL surface a proactive suggestion — a crew-mate the viewer hasn't seen in a while — only when the viewer has opted into proactivity (off by default), and SHALL cap how often such suggestions appear so they stay rare and welcome. Suggestions SHALL be scoped to crew-mates (chosen people), never the whole contact set. The viewer SHALL be able to dismiss (snooze) a suggestion and to mute suggestions for a specific person. Suggestions SHALL use warm, non-guilting language and credit the person by name.

#### Scenario: Proactive suggestion when opted in
- **WHEN** the viewer has opted in and a crew-mate they haven't seen in a while exists, within the frequency cap
- **THEN** a soft suggestion appears offering to plan something with that person

#### Scenario: Off by default
- **WHEN** the viewer has not opted into proactivity
- **THEN** no proactive suggestion is shown

#### Scenario: Mutable and non-guilting
- **WHEN** a suggestion is shown
- **THEN** it can be snoozed and the person muted, and its wording never blames or guilts the viewer

### Requirement: Reconnecting drafts a plan, never messages silently
When the viewer accepts a suggestion, the app SHALL create a plan (via the plan-coordination proposer) pre-seeded to reconnect with that person, and take the viewer to it to review and share. The app SHALL NOT message anyone on the viewer's behalf — sharing is an explicit viewer action, the same no-account link flow as any plan.

#### Scenario: Accept drafts a plan to share
- **WHEN** the viewer accepts a suggestion
- **THEN** a plan is created (via the plan engine), pre-seeded to reconnect with that person, and the viewer lands on it to review and share

#### Scenario: No silent messaging
- **WHEN** a plan is drafted from a suggestion
- **THEN** nothing is sent to anyone until the viewer shares the link themselves

> Note: availability-aware timing ("they're free Thursday" — re-checking the person's `availability` at draft time) is a planned enhancement, not part of this baseline. The proposer picks candidate times; the invitee confirms via the normal availability-and-strike flow.

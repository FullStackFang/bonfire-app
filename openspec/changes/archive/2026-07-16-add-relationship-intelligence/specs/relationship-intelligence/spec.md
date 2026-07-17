# relationship-intelligence

## ADDED Requirements

### Requirement: Co-presence recency from real activity
The app SHALL derive, for the viewer, how long it has been since they were last actually together with each person, computed only from in-app co-presence — plans that struck and were attended, and shared presence — never from imported or scored address-book contacts. A recency value SHALL exist only for people the viewer has co-present history with.

#### Scenario: Recency reflects real co-presence
- **WHEN** the viewer and another person last struck/attended a plan or shared presence some days ago
- **THEN** the app can report that elapsed time ("you haven't seen X in N days")

#### Scenario: No recency for non-co-present contacts
- **WHEN** a person is in the viewer's contacts but they have never co-attended anything in the app
- **THEN** no recency signal is produced for that person — the app does not score the address book

### Requirement: Proactive suggestions are opt-in and frequency-capped
The app SHALL surface a proactive suggestion — someone the viewer hasn't seen in a while who is currently free — only when the viewer has opted into proactivity, and SHALL cap how often such suggestions appear so they stay rare and welcome. The viewer SHALL be able to dismiss a suggestion and to mute suggestions for a specific person. Suggestions SHALL use warm, non-guilting language and credit the person by name.

#### Scenario: Proactive suggestion when opted in
- **WHEN** the viewer has opted in, and someone they haven't seen in a while is free soon
- **THEN** a soft suggestion appears offering to plan something with that person, within the frequency cap

#### Scenario: Off by default
- **WHEN** the viewer has not opted into proactivity
- **THEN** no proactive suggestion is shown

#### Scenario: Mutable and non-guilting
- **WHEN** a suggestion is shown
- **THEN** it can be dismissed and the person muted, and its wording never blames or guilts the viewer

### Requirement: Agentic plan draft on acceptance
The app SHALL, when the viewer accepts a proactive suggestion, draft a concrete plan (time + place) using the plan-coordination proposer — pre-addressed to the suggested person and a mutually-free time — and let the viewer review it before an invite is sent. The app SHALL re-check the person's availability at draft time and frame the proposed time as a proposal the invitee still confirms, never a fait accompli. The app SHALL NOT message anyone on the viewer's behalf without an explicit confirm.

#### Scenario: Accept drafts and sends after review
- **WHEN** the viewer accepts a suggestion and confirms the drafted plan
- **THEN** a plan is created (via the Phase 1 engine) and an invite is sent to the suggested person, who then confirms through the normal availability-and-strike flow

#### Scenario: No silent messaging
- **WHEN** a plan is drafted from a suggestion
- **THEN** nothing is sent to anyone until the viewer explicitly confirms

# network-discovery

## Purpose

The friends-around discovery surface: shows a viewer which of their own people are around a locale (opt-in, coarse, never surveillance) and lets them go live with a spontaneous get-together that converges into a plan via the plan-coordination engine.

## Requirements

### Requirement: See which of your people are around
The app SHALL show a viewer, for a locale they are in, which of their people (friends / crew-mates) are currently around, as a roster crediting each by name with a coarse "around" signal (e.g. "free tonight", "here until Fri"). The roster SHALL be scoped to the viewer's own people — never strangers or a public feed — and SHALL never display absence, an out-list, or a flake record for anyone.

#### Scenario: Friends around a place
- **WHEN** a viewer opens the discovery surface in a place where some of their people have shared presence
- **THEN** they see a "you're in <place>" heading and a roster of those people, each credited by name with a coarse around-signal

#### Scenario: Only your people
- **WHEN** the roster is shown
- **THEN** it contains only the viewer's friends/crew-mates — no strangers, no public directory

#### Scenario: No shaming of who isn't around
- **WHEN** some people are around and others are not
- **THEN** no out-list, absence marker, or flake record is shown for anyone

### Requirement: Location is opt-in and never continuous surveillance
The app SHALL obtain any location signal only after an explicit permission from the viewer, SHALL store it as a discrete, refreshable reading rather than continuously tracking the person, and SHALL make location visible only to the viewer's own people (never public). A viewer SHALL be able to be present ("I'm around") without sharing precise location.

#### Scenario: Permission precedes any location use
- **WHEN** the discovery surface needs a location signal and the viewer has not granted permission
- **THEN** no location is captured and the viewer is asked to opt in, with presence still possible without it

#### Scenario: Presence without precise location
- **WHEN** a viewer declines precise location but marks that they're around
- **THEN** they appear as around (coarse) to their people, with no precise distance shared

### Requirement: Start something spontaneous that converges into a plan
The app SHALL let a viewer start a spontaneous get-together by choosing an activity and a rough window (e.g. now / tonight / this week) and going live. Going live SHALL create a short-fuse plan using the existing plan-coordination engine — proposing a place, letting interested people mark availability, and confirming ("it's on") when enough are in — with the same statement-not-question, no-decline framing as a Phase-1 plan.

#### Scenario: Go live converges on a plan
- **WHEN** a viewer picks an activity and a window and goes live, and enough of their people are in
- **THEN** a plan is created, a place is proposed, and it confirms to "it's on" through the same availability-and-strike flow as a shared plan

#### Scenario: Availability-aware
- **WHEN** the discovery surface indicates who's around
- **THEN** it reflects self-reported availability (who is actually free), not merely who opened the app

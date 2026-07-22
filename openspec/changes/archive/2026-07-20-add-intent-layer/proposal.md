# add-intent-layer

## Why

The ember captures "that was fun, again" (activity intent), but there is no way to register the other half of recurrence: "I want to see *her* again" (person intent). Today that thought evaporates — or gets routed through system-derived reconnect nudges, which guess at it from co-attendance recency instead of letting the person say it. And nothing joins the two signals: a mutual ember, a mutual person intent, and an availability overlap should converge into one draft plan, but each currently sits in its own silo.

This change also lands the doctrine that keeps the whole intelligence direction non-creepy — the campfire rules. People aren't creeped out by being known; they're creeped out by being known from the wrong source or reminded in the wrong room. Codifying provenance, scope, surfacing, and decay *now*, in the first change that resurfaces knowledge about people, means every later intelligence surface (dietary picks, activity affinities, venue preferences, availability rhythms) inherits the constraints instead of retrofitting them.

## What Changes

- **Person intent** — a new one-tap object `{from, to, source_plan, timestamp}`: unilateral capture, mutual-only reveal, reusing the ember's proven privacy model (silence invisible, one-sided interest never exposed, no rejection surface, withdrawable). No user-facing fields — one tap, one timestamp; all intelligence lives in resurfacing, none in capture.
- **Two-zone afterglow** — the completed-plan screen at `/p/plan/[token]` gains a second zone: below the existing "do this again?" button, the faces of co-attendees, each tappable as a person intent. **BREAKING** relative to the again-engine spec's "no other controls" requirement (deliberate: the second zone is part of the same five-second capture moment).
- **Intent resolver** — a pure read-time function (the `resolveAvailability` / `staleCrewMates` precedent: derived, no materialized state, no cron, no timers) that joins mutual embers × mutual person intents × availability into ranked draft-plan candidates. Compound matches (one plan satisfying both an activity and person intents) rank highest.
- **Pull-first surfacing** — resolver output surfaces only at existing touchpoints (dashboard card); an intent alone never generates a notification. Matching and drafting are automatic; **sending never is** — accepting a candidate drafts a plan via the plan-coordination proposer and the human shares the link, same as ember-seeding and reconnect today.
- **Campfire-knowledge doctrine** — a governing capability constraining every intelligence surface, this change's resolver first: (1) *provenance* — the system knows only what was performed on Bonfire's own surfaces, never imported or inferred; (2) *scope* — observed knowledge is crew-scoped, never aggregated into a person-level profile; (3) *surfacing* — knowledge appears only as improved defaults (ranking, weighting, timing), never as displayed facts, profile cards, or insight panels — the coordinator gets outputs, not access; (4) *decay* — observed facts lose weight without behavioral re-confirmation and time-bound facts auto-expire. Declared signals (intent taps, ember taps) are distinct: deliberate speech acts whose mutuality-gated reveal is the feature; they don't decay — they're withdrawable.
- **Out of scope (phase 2, documented as deferred):** ambient capture — registering a person intent outside the afterglow moment (SMS to the Bonfire number, share-sheet, widget). Needs inbound Twilio, parsing, and person-resolution against the co-attendance graph; deferred so it cannot drag the tap mechanic.
- **Out of scope (follow-up delta):** pushing mutual-match reveals through the reconnect nudge channel. Baseline surfacing is pull-only; the opt-in nudge integration is a later change against `relationship-intelligence`.

## Capabilities

### New Capabilities

- `person-intent`: the directed one-tap "see them again" object — capture on the afterglow screen, unilateral storage, mutual-only symmetric reveal ("you both wanted this"), withdrawal, and the API rule that unreciprocated taps are indistinguishable from silence.
- `intent-resolver`: the read-time matching engine — joins mutual embers, mutual person intents, and availability into ranked draft-plan candidates; compound scoring; pull-first dashboard surfacing; candidates speak through defaults (a suggested window), never displayed facts ("Kat is free Thursday"); accept → draft plan via the plan proposer, never auto-send.
- `campfire-knowledge`: the doctrine capability — provenance (in-campfire only, no imports, no inference), crew scope (no person-level aggregation), surfacing as defaults (no UI renders a person as a record), and decay (facts fade without re-confirmation; time-bound facts auto-expire). Mostly constraint requirements that future intelligence changes build against.

### Modified Capabilities

- `again-engine`: the afterglow requirement "SHALL present no other controls" changes — the screen becomes two zones (activity tap + person-intent faces). Eligibility, ember mechanics, and mutual-visibility rules are unchanged.

## Impact

- **Schema:** new `pulse.person_intents` table (one migration), keyed on `pulse.participants(id)` pairs like `pulse.ember_taps`; embers/plans untouched.
- **Server:** new `apps/web/lib/pulse/person-intent.ts` (capture + reveal rules) and `apps/web/lib/pulse/intent-resolver.ts` (pure resolver); reuses `resolveAvailability`, ember read helpers, and the plan proposer.
- **API:** new tap/untap endpoint under `/api/pulse`; afterglow payload extended with tappable co-attendees (subject to person-intent privacy rules); dashboard payload extended with resolver candidates.
- **UI:** afterglow screen at `/p/plan/[token]` gains zone two; dashboard gains the candidates card. Both breakpoints (~390px and ≥1100px) per house rules.
- **Unchanged:** Asker rail, mobile app, reconnect behavior, availability engine, notification posture (no new sends of any kind).

# close-plan-loop

## Why

The July 16 interview study's most important structural finding is the **fizzle effect**: friendships die in the gap after a good first gathering, because re-initiating next week costs someone social courage. Today the Pulse rail plan engine ends exactly there — `struck` is a terminal state, so the moment of peak warmth (everyone just hung out) has no product surface. Separately, a plan whose `closes_at` passes simply **expires and dies**, even when people marked availability — open-ended deliberation is where "yes for now, unless something better comes up" flakiness lives.

This change closes the loop: capture recurrence intent at the moment courage is free (the "Again?" tap, the thesis's sanctioned "again" engine from `design/SYSTEM-THESIS.md` §iv), and make deadlines decide rather than kill (deadline auto-strike). It is the hinge where a one-off becomes a repetition — the entire thesis compressed into one tap.

## What Changes

- **Plan lifecycle gains a post-event state**: a `struck` plan whose winning option's time has passed becomes `completed`. `struck` is no longer terminal.
- **The "Again?" afterglow screen**: after completion, everyone who marked the winning option (including tier-0 no-account participants — they hold the link) sees a one-button post-event screen on `/p/plan/[token]`: *do this again?* One tap, no other controls.
- **The ember object**: each "again" tap creates/joins an **ember** — a standing recurrence intent scoped to that gathering (these people, this activity). Non-taps are invisible: no reminder to non-tappers, no roster of who didn't tap, one-sided interest never exposed. Mutual embers (2+ taps) surface to their tappers and can seed a new plan through the existing plan engine, pre-filled.
- **Deadline auto-strike**: when `closes_at` passes on an `open` plan, if any option has availability marked, the plan strikes on the best option (most availability, earliest time as tiebreak) instead of expiring. `expired` now only means nobody marked anything.
- Copy throughout follows the house voice: statements not questions in outcomes ("it's on Thursday"), warm, no guilt, no exclamation hype. (The "again?" button itself is the thesis's own sanctioned question.)

## Capabilities

### New Capabilities
- `again-engine`: post-event recurrence-intent capture — the completed-plan afterglow screen, the ember object (creation, mutual visibility, silence-is-invisible rules), and seeding a follow-on plan from a mutual ember via plan-coordination.

### Modified Capabilities
- `plan-coordination`: (1) lifecycle gains `completed` — a struck plan transitions after its winning time passes; (2) `closes_at` semantics change from "expire unconditionally" to "auto-strike the best option when any availability exists; expire only when none does".

## Impact

- **Schema**: `pulse.plans.state` check constraint gains `completed`; new `pulse.embers` (+ member/tap table) migration; auto-strike needs a transition path (on-read lazy transition or scheduled sweep — design decision).
- **API**: `apps/web/app/api/pulse/*` plan routes — state transitions, new ember endpoints (tap, list mine, seed plan).
- **UI**: `/p/plan/[token]` gains the completed/afterglow view; the opener's Pulse dashboard gains an embers presence (minimal).
- **Reuses**: strike logic (extends the existing atomic/idempotent strike), plan proposer for ember-seeded plans, tier-0/ghost-merge identity as-is.
- **Feeds (follow-up, not in scope)**: `relationship-intelligence` — mutual embers become a stronger rekindle trigger than raw co-attendance recency; `SYSTEM-THESIS.md` §iii standing-cadence auto-spawn becomes possible once embers exist.
- **Not touched**: Asker rail, SMS, mobile app, crews.

# Insight Register

> Program-level companion to `ROADMAP.md`. Records external research insights — one row per insight — each with a stable ID, a verdict (what the study concluded), a build status (our build reality), and an evidence pointer. Source of the seed rows: the 2026-07-16 consumer interview study (mentor session directions cross-referenced against interview data; notes not committed to the repo).

## Legend

Each insight is classified on two axes. Verdict and status are kept separate because a validated insight can still be unbuilt, and an inverted one is "done" as a decision without matching the literal idea.

**Verdict** (what the study concluded):

| Value | Meaning |
|---|---|
| `VALIDATED` | Interview data supports the insight as stated |
| `VALIDATED-INVERTED` | Right instinct, wrong form — the inverse shape is what's supported |
| `ACQUISITION-TACTIC` | Real, but it's distribution, not a product category |
| `PARK` | Not supported for near-term pursuit |

**Status** (our build reality):

| Value | Meaning |
|---|---|
| `BUILT` | Shipped and verified; evidence pointer required |
| `PARTIAL` | Some of it exists, honestly not all; evidence pointer required |
| `BUILD-NEXT` | Validated and queued — the pool `opsx:propose` draws from |
| `INVERTED` | The superseded (inverted) form is what's built/planned; evidence pointer required |
| `PARKED` | Deliberately not pursued |
| `DEFERRED` | Held at roadmap altitude; no owner yet |

IDs are permanent handles (`D1`–`D6` mentor directions, `M1`–`M4` proposed mechanics) for cross-referencing in commits, specs, and future studies — never reassigned. Future studies add a new dated section with its own ID prefix.

## Maintenance

Hand-maintained; updated at three moments:

1. **A new external study lands** → add a new dated section with its own ID prefix.
2. **A `BUILD-NEXT` item is promoted** → promotion happens only via a separate OpenSpec change created with `opsx:propose`; link that change in the row and flip status toward `PARTIAL`/`BUILT` as work verifies.
3. **A build verifies end-to-end** → flip the row to `BUILT` with its evidence pointer.

The register triages and tracks; it does not implement, and it does not overrule `ROADMAP.md` or `conflicts.md`.

## 2026-07-16 — Consumer interview study

| ID | Insight | Verdict | Status | Evidence |
|----|---------|---------|--------|----------|
| D1 | Shenanigan coordinator as primary customer | VALIDATED | BUILD-NEXT | coordinator-exoskeleton framing; no coordinator-specific surface yet |
| D2 | Repetition mechanics (spaced repetition, free-time surfacing, opt-out recurrence) | VALIDATED | BUILT | specs `relationship-intelligence`, `who-is-around`; `apps/web/app/p/Reconnect.client.tsx`, `/p/around` |
| D3 | Event aggregation / curated digest | VALIDATED-INVERTED | INVERTED | inversion = heat-map "your people are going" → spec `network-discovery` (substrate); curator-arming unbuilt |
| D4 | The concierge (personalized recommendations) | VALIDATED-INVERTED | BUILD-NEXT | works only as one-time *ignition* (GoodRec model), not ongoing infra; unbuilt |
| D5 | Board + Pulse (durable board, expiring pulses) | ACQUISITION-TACTIC | PARTIAL | crew board `/p/c/[token]` (`Board.client.tsx`), spec `crews`; not framed for graph-import spikes |
| D6 | B2B conferences | PARK | PARKED | out of near-term scope |
| M1 | The "Again?" tap (post-event recurrence capture, the fizzle-killer) | VALIDATED | BUILT | spec `again-engine`; `apps/web/lib/pulse/ember.ts`, `copy.ts` (`tapCta`), `plan.ts` afterglow |
| M2 | Coordinator succession (micro-roles, redundancy as retention) | VALIDATED | BUILD-NEXT | unbuilt; pairs with D1 |
| M3 | Deliberation caps (options auto-collapse at deadline) | VALIDATED | BUILT | spec `plan-coordination`; `apps/web/lib/pulse/plan.ts` strike + `pickDeadlineWinner()` |
| M4 | Life transitions as acquisition timing | VALIDATED | DEFERRED | marketing/targeting, not a product surface; no owner yet |

## Context

Product direction is governed by `design/growth-story/ROADMAP.md` (phases) and `conflicts.md` (resolved thesis conflicts). External research now feeds that program: the 2026-07-16 consumer interview study cross-references the mentor session's six directions against interview data and adds four proposed mechanics. Much of it validates work already shipped (`again-engine`, `relationship-intelligence`, `who-is-around`, `plan-coordination`), some is validated-but-unbuilt, and some should be parked. There is no durable artifact that captures this triage or tracks it over time — it lives only in the meeting-notes prose. This change adds that artifact and the convention for keeping it honest.

## Goals / Non-Goals

**Goals:**
- One durable, versioned register that answers, per insight: *what did we decide, is it built, where's the evidence.*
- A fixed status vocabulary so triage is legible at a glance and greppable.
- A stated upkeep rule: when the register changes, and how `BUILD-NEXT` items become OpenSpec changes.
- Seed it completely with the 2026-07-16 study so it's useful on day one, not an empty template.

**Non-Goals:**
- Implementing any unbuilt insight (coordinator succession, curator-arming distribution, etc.). Promotion to a build is a separate `opsx:propose`.
- Re-deciding direction. The register records the study's verdicts and our build reality; it does not overrule `ROADMAP.md`/`conflicts.md`.
- A database, tooling, or automation. This is a hand-maintained markdown doc.

## Decisions

**D1 — Location: `design/growth-story/INSIGHT-REGISTER.md`.**
The register is program-level, exactly like `ROADMAP.md` and `conflicts.md`, and its rows point at growth-story phases. Placing it beside them (rather than at `design/` root or in `openspec/`) keeps program governance in one folder. *Alternative:* `openspec/` — rejected: OpenSpec changes are meant to open and archive, but the register is a standing document that never "completes."

**D2 — Fixed status vocabulary (two axes).**
Each insight carries a **verdict** (what the study concluded) and a **status** (our build reality). Kept separate because a validated insight can still be unbuilt, and an inverted one is "done" as a decision without matching the literal idea.

- *Verdict:* `VALIDATED` · `VALIDATED-INVERTED` (right instinct, wrong form) · `ACQUISITION-TACTIC` (real, but distribution not category) · `PARK`.
- *Status:* `BUILT` · `PARTIAL` · `BUILD-NEXT` (validated + queued) · `INVERTED` (superseded form is what's built/planned) · `PARKED` · `DEFERRED` (roadmap-held).

**D3 — Stable IDs.** Directions `D1`–`D6` (the six mentor ideas), mechanics `M1`–`M4` (the four proposed). IDs are permanent handles for cross-referencing in commits, specs, and future studies. Future studies add a new dated section with its own ID prefix.

**D4 — Evidence pointer is mandatory for anything not unbuilt.** A `BUILT`/`PARTIAL`/`INVERTED` row MUST cite the spec, file, or roadmap phase that backs the claim (e.g. `spec: again-engine`, `apps/web/lib/pulse/ember.ts`). This is what prevents optimistic self-grading.

**D5 — Maintenance convention, not automation.** The register is updated by hand at three moments: (a) a new external study lands → add a section; (b) a `BUILD-NEXT` item is promoted → link its OpenSpec change and flip toward `PARTIAL`/`BUILT`; (c) a build verified end-to-end → flip to `BUILT` with the evidence pointer. A one-line pointer in `ROADMAP.md` keeps it discoverable.

### Seeded triage (2026-07-16 study → build reality)

| ID | Insight | Verdict | Status | Evidence |
|----|---------|---------|--------|----------|
| D1 | Shenanigan coordinator as primary customer | VALIDATED | BUILD-NEXT | coordinator-exoskeleton framing; no coordinator-specific surface yet |
| D2 | Repetition mechanics (spaced repetition, free-time surfacing, opt-out recurrence) | VALIDATED | BUILT | specs `relationship-intelligence`, `who-is-around`; `Reconnect.client.tsx`, `/p/around` |
| D3 | Event aggregation / curated digest | VALIDATED-INVERTED | INVERTED | inversion = heat-map "your people are going" → spec `network-discovery` (substrate); curator-arming unbuilt |
| D4 | The concierge (personalized recommendations) | VALIDATED-INVERTED | BUILD-NEXT | works only as one-time *ignition* (GoodRec model), not ongoing infra; unbuilt |
| D5 | Board + Pulse (durable board, expiring pulses) | ACQUISITION-TACTIC | PARTIAL | crew board `/p/c/[token]`, spec `crews`; not framed for graph-import spikes |
| D6 | B2B conferences | PARK | PARKED | out of near-term scope |
| M1 | The "Again?" tap (post-event recurrence capture, the fizzle-killer) | VALIDATED | BUILT | spec `again-engine`; `apps/web/lib/pulse/ember.ts`, `copy.ts` (`tapCta`), `plan.ts` afterglow |
| M2 | Coordinator succession (micro-roles, redundancy as retention) | VALIDATED | BUILD-NEXT | unbuilt; pairs with D1 |
| M3 | Deliberation caps (options auto-collapse at deadline) | VALIDATED | BUILT | spec `plan-coordination`; `plan.ts` strike + `pickDeadlineWinner()` |
| M4 | Life transitions as acquisition timing | VALIDATED | DEFERRED | marketing/targeting, not a product surface; no owner yet |

## Risks / Trade-offs

- **[Register rots like any hand-maintained doc]** → the upkeep convention (D5) ties updates to concrete events (study lands, item promoted, build verified), and the `ROADMAP.md` pointer keeps it in the path of anyone reading program direction.
- **[Optimistic self-grading — marking things BUILT that aren't wired end-to-end]** → mandatory evidence pointer (D4) plus the explicit `PARTIAL` status (used here for D5 board and elsewhere) force honesty; e.g. the location-map work is `PARTIAL`, not `BUILT`.
- **[Two-axis vocabulary is more than a single "status" column]** → kept because collapsing verdict and status loses the exact distinction the study cares about (validated-but-unbuilt vs. inverted-and-done); the axes are few and fixed.
- **[Scope creep — register becomes a second roadmap]** → Non-Goals bar it from overruling `ROADMAP.md`; it records evidence and triage, and `BUILD-NEXT` is only a queue that `opsx:propose` draws from.

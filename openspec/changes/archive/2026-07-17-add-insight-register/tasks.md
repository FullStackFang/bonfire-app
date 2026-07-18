## 1. Create the register

- [x] 1.1 Create `design/growth-story/INSIGHT-REGISTER.md` with a short header (purpose, companion to `ROADMAP.md`, source study `design/growth-story/` meeting notes dated 2026-07-16) and a legend defining the two axes and the fixed vocabularies (verdict: `VALIDATED` / `VALIDATED-INVERTED` / `ACQUISITION-TACTIC` / `PARK`; status: `BUILT` / `PARTIAL` / `BUILD-NEXT` / `INVERTED` / `PARKED` / `DEFERRED`)
- [x] 1.2 Add a "Maintenance" section documenting the upkeep convention (update when a study lands / an item is promoted / a build verifies) and the promotion rule (a `BUILD-NEXT` item becomes a build only via a separate `opsx:propose` change)

## 2. Seed the 2026-07-16 study

- [x] 2.1 Add a `## 2026-07-16 — Consumer interview study` section with the triage table (columns: ID, Insight, Verdict, Status, Evidence)
- [x] 2.2 Fill rows `D1`–`D6` (six mentor directions) per design.md, each with verdict, status, and an evidence pointer where status is not unbuilt
- [x] 2.3 Fill rows `M1`–`M4` (four proposed mechanics) per design.md; verify each `BUILT` row's evidence pointer resolves (`again-engine` → `apps/web/lib/pulse/ember.ts`; `plan-coordination` → `plan.ts` `pickDeadlineWinner`; `relationship-intelligence`/`who-is-around` → `Reconnect.client.tsx`, `/p/around`)
- [x] 2.4 Mark honestly-partial items `PARTIAL` (e.g. `D5` board), not `BUILT`; cross-check against the codebase before assigning any `BUILT`

## 3. Link and verify

- [x] 3.1 Add a one-line pointer to `INSIGHT-REGISTER.md` from `design/growth-story/ROADMAP.md`
- [x] 3.2 Verify every `BUILT`/`PARTIAL`/`INVERTED` row carries an evidence pointer and every status/verdict value is from the fixed set (spec requirement compliance)
- [x] 3.3 Confirm no file under `openspec/specs/` and no application code was modified by this change (docs + roadmap pointer only)

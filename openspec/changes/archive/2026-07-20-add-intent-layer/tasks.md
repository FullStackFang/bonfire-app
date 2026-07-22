# add-intent-layer — Tasks

## 1. Schema

- [x] 1.1 Migration: `pulse.person_intents (from_participant_id, to_participant_id, source_plan_id, created_at)`, PK `(from, to)`, FKs to `pulse.participants` and `pulse.plans`, self-tap check (`from <> to`); comment the privacy contract like the ember migration does
- [x] 1.2 Extend the ghost-merge helper to re-point `person_intents.from/to`, keeping the earliest row on pair-PK collision; add a merge test covering a collision

## 2. Person-intent engine (lib)

- [x] 2.1 `lib/pulse/person-intent.ts`: `canTapPerson(plan, fromId, toId)` — completed plan, both endpoints marked the winning option (mirror `canTapEmber`)
- [x] 2.2 `tapPerson` / `untapPerson` — idempotent insert (`on conflict do nothing`, original timestamp stands), delete on withdraw
- [x] 2.3 Pure visibility function (mirror `publicEmberFromTaps`): empty shape for no-identity/no-tap viewers, own-tap-only for one-sided, symmetric reveal on mutual; single implementation behind every read path
- [x] 2.4 Unit tests: idempotent re-tap keeps timestamp, withdrawal reverts mutual on both sides, one-sided invisible to recipient, no timestamps in any public shape

## 3. Afterglow zone two (API + UI)

- [x] 3.1 Extend the completed-plan payload with tappable co-attendees (winning-option markers minus viewer) + the viewer's own tap/mutual state per face; assert one-sided-toward-viewer rows never serialize
- [x] 3.2 Tap/untap endpoint under `/api/pulse` gated by `canTapPerson`
- [x] 3.3 Two-zone afterglow at `/p/plan/[token]`: zone one visually primary, faces tappable/withdrawable below, mutual badge per visibility rules; no counters or progress states
- [x] 3.4 Verify both breakpoints (~390px and ≥1100px) via `/p/s/preview`-style no-write path; spark-dot vocabulary, no repeated flame motif

## 4. Intent resolver

- [x] 4.1 `lib/pulse/intent-resolver.ts`: pure `resolveIntents(viewerId)` joining mutual embers (`emberTapsForPlans`), mutual person intents, and `resolveAvailability`; no writes, no new tables
- [x] 4.2 Ranking per spec: compound > ember > person-intent-only; availability overlap boosts within tier; `unknown` never excludes; cap candidates and only resolve availability for the top tier
- [x] 4.3 Candidate shape `{people, seedIntent, sourceEmber?, suggestedWindow?}`; person-intent-only candidates seed the pair with no activity (reconnect-style)
- [x] 4.4 Unit tests: compound collapses to one candidate, unmatched intents yield nothing and write nothing, unknown availability passes through without a window

## 5. Dashboard surfacing + accept

- [x] 5.1 Dashboard payload gains resolver candidates (pull-only; confirm no notification/delivery path is touched)
- [x] 5.2 Candidates card on the dashboard, both breakpoints; warm copy, no age-of-intent framing anywhere
- [x] 5.3 Accept → create plan via the plan-coordination proposer seeded from the candidate, owned by the viewer, landing on it to review and share; no plan row exists before acceptance (test)
- [x] 5.4 Campfire Rule 3 compliance: candidate payload carries the suggested window but no per-person availability state/label; card copy never attributes a fact to a person ("Kat is free Thursday" forbidden); no reasons/insights affordance anywhere (payload-shape test + copy review)

## 6. Verify

- [x] 6.1 `npm run test` green in apps/web; `npm run build:web` clean
- [x] 6.2 End-to-end hands-on run: complete a plan → two taps from different participants → mutual reveal → compound candidate on dashboard → accept → review/share; confirm the untapped third participant sees nothing throughout
- [x] 6.3 Doc note in `design/growth-story/ROADMAP.md` linking the intent layer as the ember follow-up delta; record phase-2 ambient capture as deferred
- [x] 6.4 Doctrine sweep: confirm no new surface renders a person as a record (no attribute lists, no fact enumeration, no cross-crew read paths introduced); note the shipped availability-color tension as a founder question, not a regression

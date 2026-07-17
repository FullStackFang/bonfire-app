# close-plan-loop — tasks

## 1. Schema

- [x] 1.1 New migration `supabase/migrations/20260717000000_pulse_ember_schema.sql`: widen `pulse.plans.state` check constraint to include `completed`; create `pulse.embers` (id, plan_id unique FK, intent_snapshot, created_at) and `pulse.ember_taps` (ember_id FK, participant_id FK, tapped_at, PK(ember_id, participant_id)); RLS matching the existing pulse-schema pattern
- [x] 1.2 Add `completed` to the plan state union + ember types in `apps/web/lib/pulse/types.ts` (and `packages/shared` if plan state is mirrored there)

## 2. Lifecycle transitions (lib)

- [x] 2.1 In `apps/web/lib/pulse/plan.ts`, add `resolvePlanState`: lazy, idempotent transitions — `open` past `closes_at` → auto-strike best option (most availability, earliest start, then rank; conditional single-statement update reusing the existing strike) or `expired` when zero selections; `struck` past winning-option start + 4h (or strike + 24h when timeless) → `completed`
- [x] 2.2 Call `resolvePlanState` in every plan read path (plan GET/state route, `/p/plan/[token]` page load, `dashReads.ts`)
- [x] 2.3 Unit tests in `plan.test.ts`: deadline strike pick + tiebreaks, zero-selection expiry, completion buffers, idempotence under racing transitions (spec scenarios: "Deadline resolution is race-safe", "Completion is idempotent under concurrent reads")

## 3. Ember engine (lib + API)

- [x] 3.1 New `apps/web/lib/pulse/ember.ts`: create-on-first-tap (snapshot intent), idempotent tap, un-tap, eligibility check (participant marked the winning option), and a serializer that enforces visibility — tappers only, co-tapper names only when mutual (≥2), never any untapped-participant data
- [x] 3.2 API routes under `apps/web/app/api/pulse/plan/[token]`: POST/DELETE tap, GET ember state (visibility-enforced), rate-limited like existing plan routes
- [x] 3.3 Unit tests in `ember.test.ts`: first-tap creates, double-tap records once, un-tap reverts mutuality, solo tapper sees only self, non-tapper gets nothing, API payload never contains untapped participants

## 4. Afterglow UI

- [x] 4.1 `/p/plan/[token]`: render the afterglow view when `state = 'completed'` — one warm line (house voice, credit the gathering) + single "do this again?" button for winning-option markers; non-markers see the outcome with no tap control
- [x] 4.2 Post-tap states: solo ("you're in for another one"), mutual (co-tappers credited by name + "start the next one"); copy strings in `copy.ts`
- [x] 4.3 Opener's dashboard (`dash.client.tsx` / `dashReads.ts`): completed plans remain visible; mutual embers surface minimally

## 5. Seed the next plan

- [x] 5.1 "Start the next one" flows into the existing plan-creation path (`/p/plan/new` + proposer) with intent pre-seeded from `intent_snapshot` + co-tapper names, owned by the initiator; nothing is sent to anyone
- [x] 5.2 Test: seeded plan is a normal `proposing` plan with the pre-seeded intent; no messages dispatched

## 6. Verify

- [x] 6.1 `npm run test` (apps/web) green; `npm run lint:web` and `npm run build:web` clean
- [x] 6.2 End-to-end hands-on run (local PGlite stack per memory): create plan → mark availability → pass deadline → auto-strike → pass event time → afterglow → two taps from two identities (one tier-0) → mutual reveal → seed next plan
- [x] 6.3 Update `design/growth-story/ROADMAP.md` status: close-plan-loop built, ember noted as the future relationship-intelligence trigger

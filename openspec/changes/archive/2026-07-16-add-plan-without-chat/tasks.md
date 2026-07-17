# Tasks: Add Plan Without the Group Chat (Phase 1)

> **C1 resolved → C1-C (availability, not RSVP).** Selection UI is un-gated: friends mark **which options they're free for** (availability framing), there is **no "can't make any"/decline control**, and presence at the locked plan is a plain "I'm in" statement. See `design/growth-story/conflicts.md`.

## 0. Pre-work

- [x] 0.1 Load the `claude-api` and `vercel:ai-sdk` skills before writing any AI code — confirm current model IDs, `generateObject` usage, and the `@ai-sdk/anthropic` provider setup
- [x] 0.2 Read the Pulse share-link + OG prior art (`apps/web/app/p/s/[token]/`, `opengraph-image.tsx`) and identity layer (`apps/web/lib/pulse/identity.ts`, `/api/pulse/verify`) before designing routes
- [x] 0.3 Read Asker's strike-at-K logic (`apps/web/lib/asker/repo.ts` `replyAndMaybeStrike`) — the function being ported

## 1. Schema

- [x] 1.1 New migration in `supabase/migrations/` adding `pulse.plans`, `pulse.plan_options`, `pulse.plan_picks` (columns per `design.md` §2); FKs to `pulse` participants; unique `plans.token`
- [x] 1.2 Extend the `pulse` TS types to mirror the new tables
- [x] 1.3 Apply locally (PGlite per `pulse_local_db` memory) and confirm the tables/constraints

## 2. Ported vote-and-confirm domain logic

- [x] 2.1 Create `apps/web/lib/pulse/plan.ts`: create-plan, record-pick, and `strikePlan()` (atomic, idempotent threshold flip) — ported from Asker's strike-at-K, transport-agnostic, `pulse.*` only, no SMS
- [x] 2.2 Unit-test `strikePlan()`: threshold reached → single strike; concurrent picks crossing threshold → exactly one winning option; below threshold → no strike

## 3. AI proposer

- [x] 3.1 Add `ai` + `@ai-sdk/anthropic` to `apps/web/package.json`; wire the Anthropic API key via env (document in deploy notes)
- [x] 3.2 Create `apps/web/lib/pulse/plan-ai.ts`: `proposeOptions(intent, context)` using `generateObject` against a strict Zod schema `{ times[], places[] }` with per-option rationale; default model per §4 of design
- [x] 3.3 Deterministic fallback: on model error/timeout, return a small sensible option set from context so create never hard-fails
- [x] 3.4 Test: valid intent → schema-valid ranked options; forced model failure → fallback options, no throw; intent containing injection-style text does not alter output shape

## 4. API + routes (non-selection)

- [x] 4.1 `POST /api/pulse/plan` — create plan from intent, invoke `proposeOptions`, return plan + options (opener identity from `getViewer()`/tier-0 cookie)
- [x] 4.2 `POST /api/pulse/plan/[id]/publish` — opener accepts/adjusts options → mint token, state `open`
- [x] 4.3 `apps/web/app/p/plan/new/` — opener create flow (intent entry: type/speak) → proposed options → publish; house voice, chunky-press CTAs
- [x] 4.4 `apps/web/app/p/plan/[token]/page.tsx` — public no-account link view: renders plan + options for any visitor; mints tier-0 ghost participant on first interaction
- [x] 4.5 `apps/web/app/p/plan/[token]/opengraph-image.tsx` — Bonfire-branded unfurl card (opener name + plan), reusing the `/p/s/[token]` pattern

## 5. Invitee availability UI + endpoint  ✅ un-gated (C1-C)

- [x] 5.1 Resolve C1 in `design/growth-story/conflicts.md` (founder) — **C1-C (availability, no decline control)**
- [x] 5.2 `POST /api/pulse/plan/[token]/pick` — record the visitor's marked-available options under their participant; call `strikePlan()` after write
- [x] 5.3 Availability UI on `plan/[token]`: tap which proposed times you're free for (availability framing — "when you're free", never "will you come"); **no "can't make any"/decline control**; warm by-name confirmation; no out-list, no Going/Maybe/Can't
- [x] 5.4 Locked-plan "I'm in" statement: once an option is the winner, a visitor may declare presence as a plain statement (no Going/Maybe/Can't)
- [x] 5.5 Rate-limit availability posts per token+IP (reuse Pulse's rate-limit posture) to bound ghost stuffing

## 6. Confirmation surface

- [x] 6.1 On strike, `plan/[token]` and the opener's view render "it's on" — winning time+place + who's in, house voice, no exclamation hype (Pulse already polls; no SMS)
- [x] 6.2 "Add to calendar" affordance on the confirmed plan
- [x] 6.3 (Decide per design Open Q) confirmed-plan card in `pulse-dashboard`, or defer to a fast-follow change

## 7. Verification

> **C1 testing DONE (2026-07-16).** Verified hands-on in a real browser (Playwright) against `dev:local` with the live AI gateway: opener typed intent → **real Sonnet options with future dates** (Jul 21–24; the past-dates fix confirmed live) → publish → no-account link view → tapped an option ("1 free", by-name thanks) → a second device crossed the threshold → the link **auto-flipped to "it's on"** via the poll (no reload) with winner + "2 of you are in" + a correct Add-to-calendar link.

- [x] 7.1 `npm run test` in `apps/web` green; `npm run lint:web` and `npm run build:web` clean
- [x] 7.2 E2E on local DB (PGlite): opener intent → AI options → publish link → open link in a fresh browser profile (no account) → make a selection → threshold reached → both views show "it's on"  _(verified in-browser 2026-07-16)_
- [x] 7.3 E2E appless: the plan link is fully usable with no sign-in; verification is offered, not required; selection persists under the ghost identity  _(verified in-browser 2026-07-16)_
- [x] 7.4 Confirm the OG unfurl renders (fetch the `opengraph-image` route) and names the opener + plan
- [x] 7.5 Confirm AI failure path: with the model key unset/forced-fail, create still returns fallback options and the flow completes

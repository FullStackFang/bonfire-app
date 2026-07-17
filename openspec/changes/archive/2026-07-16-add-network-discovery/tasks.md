# Tasks: Add Network Discovery (Phase 2)

> **Gates resolved (2026-07-16):** surface → **web Pulse rail `/p`**; location → **coarse, no GPS** (self-reported "around", optional self-typed locale, no distances, friends-only); network presence → a **new `pulse.around` signal beside** crew `pulse.presence`. See `design.md`.

## 0. Decisions (gate the build)

- [x] 0.1 Surface → web Pulse rail `/p`
- [x] 0.2 Location model → coarse, no GPS (self-reported window + optional self-set locale; no device location, no distances; friends-only)
- [x] 0.3 Network presence → distinct `pulse.around` signal beside `pulse.presence`

## 1. Schema

- [x] 1.1 Migration `supabase/migrations/`: `pulse.around` (participant_id PK → one upserted signal per person, optional `locale` text, `around_until` timestamptz, `updated_at`). No location/coords column (coarse decision).
- [x] 1.2 Extend pulse TS types with the around row + a public "person around" shape (name + coarse label + locale; never a distance).
- [x] 1.3 Apply locally (PGlite) and confirm.

## 2. Domain logic (`lib/pulse/around.ts`)

- [x] 2.1 `setAround(participantId, window, locale?)` — resolve window (now/tonight/this-week) to `around_until`, upsert; `clearAround(participantId)`
- [x] 2.2 `peopleAround(viewerParticipantId, now)` — participants who **share a crew** with the viewer and have `around_until > now`; return name + coarse label + locale, self excluded. Never surfaces absence.
- [x] 2.3 DB-gated tests: set/clear; roster shows only crew-overlap people who are still around; expired signals drop off; no strangers.

## 3. API + discovery surface

- [x] 3.1 `POST /api/pulse/around` — set/clear the viewer's around signal (identity via cookie participant; rate-limited)
- [x] 3.2 `GET /api/pulse/around/state` — poll target for the roster (coarse; no distances)
- [x] 3.3 `apps/web/app/p/around/` — discovery surface: "you're around <locale>" + an "I'm around" toggle (window + optional locale) + the people-around roster (names + coarse signal). `bp-*` styling, house voice, no shaming/out-list.

## 4. Spontaneous "go live" (reuses Phase 1)

- [x] 4.1 "What are you up for" (activity chips) + "when" (now/tonight/this week) entry on the around surface
- [x] 4.2 Going live seeds an intent from activity+window and creates a short-fuse plan via the existing `/api/pulse/plan` (+ tighter `closes_at`) — no new strike/convergence code
- [x] 4.3 The resulting plan link rides the normal availability→strike→"it's on" flow

## 5. Verification

- [x] 5.1 `npm run test` / `lint` / `build` clean
- [x] 5.2 E2E: two crew-mates mark "around" → each sees the other in the roster (coarse, no distance) → one goes live → a plan is created and converges
- [x] 5.3 Privacy checks: no device location ever requested; roster is crew-overlap only (no strangers); expired/absent people never shown; self excluded

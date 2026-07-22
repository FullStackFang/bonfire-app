## 1. Schema & migration

- [x] 1.1 Add `supabase/migrations/20260717000003_pulse_start_at.sql`: `ALTER TABLE pulses ADD COLUMN start_at timestamptz`, `ADD COLUMN timezone text`
- [x] 1.2 In the same migration, backfill `UPDATE pulses SET start_at = created_at WHERE start_at IS NULL`
- [x] 1.3 Confirm the existing live partial index still keys on `closed_at`/`expires_at` only (no index change needed); note `expires_at` remains the end instant

## 2. Time resolution & copy (`lib/pulse`)

- [x] 2.1 In `copy.ts`, replace `TTL_PRESETS`/`DEFAULT_TTL_PRESET` with duration presets (`1h`, `2h`, `til late`); default = `2h`
- [x] 2.2 In `time.ts`, add `resolveWhen(mode: 'now'|'later', durationKey, startPick, now)` returning `{ startAt, endsAt }` in the creator's local wall clock (`now` → start=now; `later` → start=day+time; `til late` → end of start's local day); keep/relocate the existing `resolveExpiry` clamp behavior
- [x] 2.3 In `time.ts`, add `deriveWhenLabel(startAt, endsAt, timezone)` → the display snapshot ("Now · ~2h", "Tonight 8:30pm · ~2h", "Tomorrow 9pm · til late")
- [x] 2.4 In `time.ts`, add helpers for live-state rendering from `startAt`/`endsAt` vs `now`: the upcoming "starts at/in" label and the live "for another N min" countdown
- [x] 2.5 Update `time.test.ts` for `resolveWhen` (both modes, `til late`, past-start rejection) and `deriveWhenLabel`

## 3. Domain types, lifecycle & serialize

- [x] 3.1 In `types.ts`, add `startAt` and `timezone` to `Pulse`; add `pulsePhase(pulse, now): 'upcoming'|'live'|'over'` (`upcoming` = now<start, `live` = start≤now<expires, `over` = now≥expires or closed); keep `isLive` as `phase==='live'`-equivalent
- [x] 3.2 In the public shapes (`PublicPulse`, `PublicDashPulse`, `PublicPulseListItem`), add `startAt` and `phase`; keep `live` for back-compat (= `phase==='live'`)
- [x] 3.3 In `serialize.ts`, emit `startAt`/`phase` (coalescing `startAt ?? createdAt`); ensure no internal columns leak

## 4. Repo (create & reads)

- [x] 4.1 In `repo.ts`, extend `createPulse` to accept/persist `startAt`, `timezone`, `expiresAt` (end) and the derived `timeLabel`; stop accepting free-text time
- [x] 4.2 Update pulse read/liveness queries to select `start_at` (coalesce `start_at, created_at`) so phase can be computed; confirm live lists still filter on `expires_at`/`closed_at`
- [x] 4.3 Update `repo.test.ts` for the new create shape and phase-aware reads

## 5. Create API route

- [x] 5.1 In `app/api/pulse/pulses/route.ts`, replace `timeLabel`/`expiresAt` parsing with `startAt` + `endsAt` + `timezone`; validate `startAt < endsAt` and `endsAt > now` (reject a past/closed window with a clear error)
- [x] 5.2 Derive `time_label` server-side via `deriveWhenLabel` and pass it (with `startAt`/`timezone`) to `repo.createPulse`
- [x] 5.3 Update the `pulseMessage(...)` call and OG usage to use the derived label; confirm the standalone-pulse idempotency path is unchanged

## 6. Create form (the "When" control)

- [x] 6.1 In `CreateForm.client.tsx`, remove the free-text time input and the "Stays live for" TTL segment
- [x] 6.2 Add the Now/Later mode toggle; Now shows duration presets, Later shows Today/Tomorrow chips + a time picker + duration presets
- [x] 6.3 On submit, call `resolveWhen(...)` to POST `startAt`/`endsAt`/`timezone`; disable the drop button and show an inline nudge while the resolved `startAt` is not in the future
- [x] 6.4 Verify both breakpoints (mobile ~390px and desktop ≥1100px) via `/p/new` — renders 200, clean recompile; `WhenPicker` extracted and reused by the crew-board drop sheet (`Board.client.tsx`) too, since the API break hit both create paths

## 7. Detail page — lifecycle & "End early"

- [x] 7.1 In `Pulse.client.tsx`, render three phases: **upcoming** (start label, intent-collecting, no live-huddle framing), **live** (current huddle view + countdown from `expires_at`), **over** (wrapped/ended summary)
- [x] 7.2 Move the wrap control out of the here-huddle region into a distinct, muted "End early" affordance; gate it behind a two-tap confirm; keep the `PUT /api/pulse/pulse-wrap` call + made-it summary unchanged
- [x] 7.3 Confirm reaching "here" on the status slider updates status only and never wraps (wrap removed from both YOU panels; `EndEarly` is a separate, confirm-gated control)
- [x] 7.4 Ensure `pulse-response` still rejects when over — verified: `isLive` gates on `closed_at is null && expires_at > now`, so upcoming+live are accepted and over 409s; no change needed
- [x] 7.5 Verify both breakpoints for upcoming/live/over via `/p/s/preview` — `?phase=upcoming|live|over` renders 200; markers confirm phase branching (upcoming shows "Upcoming"/"Starts"/"End early", live shows "Live now"/"End early", over shows "wrapped" with End early hidden)

## 8. Dashboard

- [x] 8.1 In the dash read/`page.tsx`, include upcoming pulses in the active section; order the active set by soonest `start_at`
- [x] 8.2 Render upcoming cards with a start label instead of a live countdown; keep over/closed under "Earlier" unchanged (`StartsAt` component gates on `phase === 'upcoming'`)
- [x] 8.3 Confirm the bounded-query guarantee holds (no per-item queries; SQL `LIMIT` on Earlier) — unchanged

## 9. Verify

- [x] 9.1 `npm run lint:web` and `npm run test` (apps/web) green — all changed files lint clean (exit 0); vitest 130 passed (one pre-existing flaky cold-import timeout in `phone.test.ts`, passes in isolation; new repo tests are DB-gated/skipped)
- [x] 9.2 `npm run build:web` clean — green now that `add-intent-layer` has landed (full route tree emitted, `tsc --noEmit` exit 0). (Was transiently red only on that change's mid-apply `PlanView`/`initialFaces` prop.)
- [x] 9.3 Smoke — DONE against the live DB (migration applied to prod). Verified: validation rejects a past/zero window (400); a **Now** pulse is live with label "Now · ~2h"; a **Later** pulse is shareable + upcoming before start with derived label "Today 11:43am · ~2h"; upcoming→live transition (soon pulse flipped after its start passed); **auto-drop** at expires_at (short pulse went over with no wrap call); **"here" never wraps** (PUT here left it live); **End early** wrap closes it (phase over). No-DB preview smoke also confirmed all three phases render + End-early gating in both trees.

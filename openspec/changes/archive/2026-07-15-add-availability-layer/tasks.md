# Tasks

Implement in order. Each numbered group leaves `apps/web` building (`npm run build:web`) and the Vitest suite green (`npm run test`). Read `apps/web/node_modules/next/dist/docs/` before using any Next 16 API. Local DB is PGlite + pg-gateway on `:5433` (see memory/scripts). The Asker rail is untouched throughout except the two verbatim hoists (1.1, 1.2).

## 1. Shared SMS transport + schema rewrite

- [x] 1.1 Hoist `deliverSms` to `apps/web/lib/sms.ts` (move body of `lib/asker/twilio.ts` verbatim, keep `SMS_DRY_RUN`); re-export from `lib/asker/twilio.ts` so no asker imports change (db.ts hoist pattern).
- [x] 1.2 Verify asker suite green after the hoist: `npm run test` + `npm run build:web`.
- [x] 1.3 Rewrite `supabase/migrations/20260612000000_pulse_schema.sql` in place: rename `containers`→`crews`, `sparks`→`pulses` (`crew_id` FK nullable, keep `unique nulls not distinct` idempotency key + partial live index), `spark_participation`→`pulse_responses`, `presence.container_id`→`crew_id`; rename event kinds (`pulse_create`, `pulse_wrap`) and add kinds `phone_verified`, `baseline_set`, `exception_set`, `sms_sent`, `around_view`.
- [x] 1.4 Same migration — add new tables: `participants.phone text unique` + `phone_verified_at`; `phone_verifications` (phone, code_hash, expires_at, attempts, consumed_at); `crew_members` (PK crew_id+participant_id, joined_at); `availability_baseline` (days_of_week int[], start/end time, timezone, label ≤40, created_at); `availability_exception` (state free|busy CHECK, starts_at/ends_at timestamptz, all_day, label ≤40); `calendar_source` (stub); `sms_deliveries` (unique (pulse_id, recipient_participant_id), twilio_sid, status, sent_at). Length caps as CHECKs everywhere.
- [x] 1.5 Rebuild local PGlite from the rewritten migration; verify all tables/constraints/indexes exist.

## 2. Rename pass (behavior-neutral)

- [x] 2.1 Rename through `lib/pulse/`: types, repo, serialize, copy, tests — `Container`→`Crew`, `Spark`→`Pulse`, `SparkParticipation`→`PulseResponse`; update SQL identifiers to the new table/column names. No behavior change.
- [x] 2.2 Rename API routes: `/api/pulse/containers`→`/api/pulse/crews`, `/api/pulse/sparks`→`/api/pulse/pulses`, `spark-status`→`pulse-response`; state endpoints follow. Page routes `/p/c/[token]` and `/p/s/[token]` keep their paths.
- [x] 2.3 Verify: full Vitest suite green under new names (these renamed suites are the carry-forward regression harness); `npm run build:web` + `npm run lint:web` clean; two-browser board smoke on local PGlite still works.

## 3. Phone identity (spec: phone-identity)

- [x] 3.1 `lib/pulse/phone.ts`: `issueVerification(phone, ip)` — E.164 normalize, hash 6-digit code, ≤10min expiry, per-phone + per-IP rate limits via `action_log`, send via `deliverSms`; `confirmVerification(phone, code)` — ≤5 attempts, single-use, sets `phone`/`phone_verified_at`.
- [x] 3.2 Ghost merge in `confirmVerification`: phone already on a canonical participant → return the canonical id and re-point the `pulse_pid` cookie (new Set-Cookie); ghost rows left orphaned.
- [x] 3.3 API routes `POST /api/pulse/verify` (issue) and `PUT /api/pulse/verify` (confirm), + `requireVerified` guard helper used by availability/crew/SMS routes only.
- [x] 3.4 Verify UI: inline phone-verify step (enter phone → enter code) reachable from any durable act; consumption paths never show it. Identity exposed only via server props/state payloads; no phone of another participant in any serialized payload.
- [x] 3.5 Unit tests: code round-trip, expiry, attempt cap, single-use, rate limit, ghost-merge repoint, `requireVerified` gating matrix (availability/crew/SMS gated; presence/response not).

## 4. Availability engine + passive flows (spec: availability)

- [x] 4.1 `lib/pulse/availability.ts`: pure `resolveAvailability({baselines, exceptions, calendarBlocks, window})` per the resolution order (calendar stub → exceptions → baseline → probably_free → unknown); timezone overlap via `Intl.DateTimeFormat` parts, no date library.
- [x] 4.2 Unit tests: baseline overlap + label, no-overlap → probably_free/low, free-exception-over-busy-baseline → free/low, busy exception + label, multi-day vacation range, all_day, unknown, midnight-spanning window, DST boundary.
- [x] 4.3 Repo + API: baseline CRUD (create/list/delete) and exception create/list — all behind `requireVerified`; funnel events `baseline_set`/`exception_set`; **no notification code path exists in these routes**.
- [x] 4.4 OnboardingAvailability UI: one question ("When are you usually tied up?"), day+time-range picker, skippable, shown once after first phone verify; browser timezone captured on save. Not a schedule editor.
- [x] 4.5 AvailabilityCorrection UI: "I'm free" / "I'm away" quick action with date-range (vacation) support; silent toast confirm.
- [x] 4.6 Verify: declare baseline → correction → resolution reflects exception-over-baseline on local PGlite; zero SMS/delivery rows written by any availability act.

## 5. Crews (spec: crews)

- [x] 5.1 Crew create gated on `requireVerified`; creator auto-inserted into `crew_members`. Tier-0 board presence unaffected.
- [x] 5.2 Join/leave: explicit join button on crew page (verified only, tier-0 sees verify prompt on tap), quiet leave; no join/leave notifications, no negative-framing lists anywhere.
- [x] 5.3 Roster serialization: member display names only (never phones); crew version bumps on roster changes so polling picks them up.
- [x] 5.4 Unit/repo tests: create-adds-creator, join idempotent, leave removes row silently, tier gating.

## 6. Pulse delivery (spec: pulse-broadcast)

- [x] 6.1 Compose flow gains optional crew pick + delivery step: "Copy message + link" always available (create response includes prewritten chat-drop message + URL); "Text the crew" only when a crew is selected and creator is a verified member — UI states explicitly who gets texted ("This texts the N people in <crew>").
- [x] 6.2 `lib/pulse/sms.ts`: `deliverPulseSms(pulseId, crewId, senderId)` — fan out one `deliverSms` per member excluding creator; insert `sms_deliveries` row first (unique (pulse_id, recipient) = dedupe, retries skip existing rows); capture per-send status; per-participant + per-crew rate limits.
- [x] 6.3 Quiet hours: 22:00–08:00 in creator's declared timezone (fallback: compose-time browser tz) → SMS option blocked with visible reason, never silently queued; link path unaffected.
- [x] 6.4 Unit tests: fan-out excludes creator, retry never double-texts, non-member/tier-0 rejected, throttle, quiet-hours block, standalone pulse sends nothing.
- [x] 6.5 Verify on local PGlite with `SMS_DRY_RUN=1`: full compose → both delivery modes; delivery rows correct; standalone appless pulse flow (create → link → respond) still green end-to-end.

## 7. Who's-Around (spec: who-is-around)

- [x] 7.1 Server-rendered `/p/c/[token]/around`: window presets (tonight / this weekend / custom), resolve every member via the engine, render order free/probably_free (green/amber) → unknown (neutral outline) → busy (muted + label); merge live board presence into rows; no negative tally or laggard framing anywhere.
- [x] 7.2 Exactly one `around_view` funnel event per load; zero notifications; no polling (refresh re-resolves).
- [x] 7.3 Tap a free/probably-free member → "drop a pulse" handoff into the composer scoped to the crew; the handoff itself sends nothing.
- [x] 7.4 Verify: mixed-availability crew renders in spec order with spec colors (coral appears only on actions/flare).

## 8. Validation

- [x] 8.1 `npm run test` green (new + renamed suites); `npm run build:web` + `npm run lint:web` clean; Asker suite untouched and green.
- [x] 8.2 Walk all five spec files against the running app on local PGlite — every requirement/scenario observably true; fix code drift, not specs.
- [x] 8.3 `openspec status --change add-availability-layer` complete; deploy checklist: pulse schema applied to production 2026-07-15 (via SQL editor — stale empty draft dropped first), Twilio env vars present (set for the Asker), WhatsApp unfurl re-check on `/p/c` + `/p/s` and one real SMS round-trip pending the next Vercel deploy. `docs/superpowers/specs/2026-07-15-availability-presence-layer-design.md` retirement pending (delete manually).

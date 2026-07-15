# Design — availability & presence layer

## Context

The `add-live-pulse` change built a link-railed, appless surface in `apps/web/app/p/`: `containers` (durable boards with one-tap presence) and `sparks` (ephemeral micro-events with participation, TTL, OG unfurl, ETag polling, rate limits). Identity is a name-typed-once cookie token (`pulse.participants`), ghosts tolerated. Nothing in the system notifies anyone, and nothing answers "who's free?" — only "what's my status right now on this board?".

The approved product design (`docs/superpowers/specs/2026-07-15-availability-presence-layer-design.md`) adds the availability layer underneath and evolves the existing objects into the thesis vocabulary (crew, pulse). Nothing pulse-side is deployed and the `20260612000000_pulse_schema.sql` migration is uncommitted, so schema evolution is free. The Asker rail (SMS via Twilio, `lib/asker/twilio.ts` with `SMS_DRY_RUN`) is live infrastructure to reuse, not touch.

Constraints: Next.js 16 conventions (async `cookies()`, `params` Promise — read `apps/web/node_modules/next/dist/docs/` before using any API); server-only `pulse` schema (no RLS/PostgREST); local dev DB is PGlite + pg-gateway on `:5433` (Windows ARM64, no Docker); design-system color semantics are load-bearing (coral = actions/flare only, never an availability state).

## Goals / Non-Goals

**Goals:**
- Answering "am I free?" costs the user zero taps — declared once, resolved thereafter.
- Three social pressures kept architecturally separate: passive (silent), broadcast (scoped, the only notifying path), ambient (pull).
- One set of objects: the existing rail's code (polling, OG, rate limits, identity) carries forward under the new names.
- Durable identity that survives browser churn, without sacrificing link-tap-in consumption.

**Non-Goals:**
- The plan flow (slots → pre-filled availability → lock → confirm) — its own follow-up change.
- Calendar-provider OAuth or busy-block sync (`calendar_source` is a stub; the resolve branch exists but always falls through).
- Native mobile screens, proximity ranking, crew matching, web push.
- Migrating tier-0 ghost activity into a merged identity (ephemeral by design).

## Decisions

### D1. Rewrite the pulse migration in place (vs. stacking rename migrations)
`20260612000000_pulse_schema.sql` is uncommitted and applied nowhere but throwaway local PGlite. Editing it directly yields one clean canonical schema with the final vocabulary. A rename migration would encode churn that never shipped. Local dev re-runs the bootstrap script to rebuild.

### D2. Two-tier identity on the existing `participants` table (vs. Supabase Auth / separate users table)
Add `phone text unique` (E.164) + `phone_verified_at timestamptz` to `pulse.participants`; tier 0 rows simply have them null. One FK target for all existing tables, no join to a users table, no auth dependency. Supabase Auth was rejected: it forces account semantics onto a rail whose growth loop is tap-a-link-you're-in, and the server-only schema can't use RLS-based auth anyway.

**OTP flow:** custom `phone_verifications` table (id, phone, code_hash, expires_at ~10min, attempts ≤5, consumed_at) + 6-digit code sent through the hoisted `deliverSms`. Twilio Verify was rejected: raw Messages API is already wired, `SMS_DRY_RUN=1` makes the whole flow testable locally with no Twilio account, and one fewer external product. Codes are hashed at rest (same posture as any credential); issuing is rate-limited per phone and per IP via the existing `action_log` mechanism.

**Ghost merge:** verifying a phone that already belongs to a participant re-points the `pulse_pid` cookie to the canonical row (new Set-Cookie), leaving the ghost row orphaned. No row migration — tier-0 presence/participation is ephemeral; the canonical row owns the baseline.

**Tier gating:** `requireVerified(participant)` guard used by exactly three act families: availability writes, crew create/join, SMS delivery. Everything else stays tier 0.

### D3. Hoist `deliverSms` to `apps/web/lib/sms.ts` (mirror of the db.ts hoist)
Move the body of `lib/asker/twilio.ts` verbatim to `lib/sms.ts`; re-export from the asker path so no asker imports change (the exact pattern task 1 of add-live-pulse used for `sql()`). Pulse code never imports from `lib/asker/**`.

### D4. `resolveAvailability` is a pure function over pre-fetched rows
`lib/pulse/availability.ts` exports `resolveAvailability(input: {baselines, exceptions, calendarBlocks, window}) → {availability, confidence, label?}` with no I/O; the repo layer fetches rows and maps over members/windows. Pure logic gets exhaustive Vitest coverage (timezone edges, midnight-spanning windows, vacation ranges) without a DB, and ports to Expo unchanged. Resolution order: calendar (stub, falls through) → exceptions (busy → `busy`+label; free → `free` at `low` confidence) → baseline overlap (`busy`+label) → no overlap (`probably_free`, `low`) → nothing declared (`unknown`, which never blocks and never reads as a "no").

**Timezone:** baselines store an IANA `timezone` captured from the browser at creation; day-of-week + time-range overlap is computed in that zone via `Intl.DateTimeFormat` part extraction (no date library added). Exceptions are absolute timestamptz — no zone math.

### D5. Pulse delivery is a compose-time choice; SMS fan-out is synchronous with a delivery log
The pulse create response always includes the prewritten chat-drop message + URL (link path costs nothing). If the creator picked "Text the crew" (requires `crew_id` + tier 1), the API fans out one `deliverSms` per `crew_members` row inside the request (crews are small; no queue infrastructure). Each send writes `sms_deliveries` (pulse_id, recipient, sent_at, twilio_sid, status) first — the unique (pulse_id, recipient) key is the dedupe guard, so a retry never double-texts. Quiet hours (22:00–08:00 in the recipient-less v1: creator's declared timezone) block the SMS option with an explicit UI reason rather than silently queueing. Creator is excluded from fan-out.

### D6. Renames land in one pass, routes included
`containers→crews`, `sparks→pulses`, `spark_participation→pulse_responses` across schema, `lib/pulse/` (types, repo, copy, serialize), API routes (`/api/pulse/crews`, `/api/pulse/pulses`, …) and pages (`/p/c/[token]` stays for crews, `/p/s/[token]` stays for pulses — short URLs are cosmetic and already shipped in copy). Event kinds and `action_log` actions rename to match (`pulse_create`, `pulse_wrap`, + new `phone_verified`, `baseline_set`, `exception_set`, `sms_sent`). The existing Vitest suites are renamed with their subjects and must stay green — they are the regression harness for the carry-forward behavior.

### D7. Who's-Around is a server-rendered read over the resolve engine
`/p/c/[token]/around` (inside the crew page shell): pick a window preset (tonight / this weekend / custom), server resolves each member, renders free/probably-free first (green/amber), unknown as neutral outline (never framed as a "no"), busy muted with label. Merged with live board presence when present. No polling needed in v1 (availability changes slowly); a refresh re-resolves. Writes exactly one funnel event (`around_view`), no notifications.

## Risks / Trade-offs

- [SMS cost/abuse: a hostile creator spams a crew] → tier-1 gate on sending, per-participant + per-crew rate limits via `action_log`, dedupe key in `sms_deliveries`, quiet hours, and crews are explicit-join rosters (you texted people who joined your crew).
- [OTP delivery failure locks users out of durable acts] → `SMS_DRY_RUN` for dev; resend with backoff; verification is only demanded lazily at the first durable act, so consumption never breaks.
- [Timezone math bugs make people look busy when free] → pure-function engine with explicit midnight-spanning and DST test cases; exceptions (absolute instants) always win, so a wrong baseline is correctable in one tap.
- [Rename churn breaks the carried-forward behavior] → the renamed Vitest suites + OG/polling/rate-limit tests are the contract; `npm run test` + `npm run build:web` green after the rename pass before any new feature code lands.
- [Quiet hours keyed to creator's timezone can still text a traveling recipient at night] → accepted for v1 (recipients have no timezone until they verify + declare); revisit when recipient timezones exist.
- [Synchronous SMS fan-out on a serverless request] → crews are small (single-digit members); Twilio calls are fire-sequential with per-send status capture; a partial failure leaves accurate `sms_deliveries` rows and the response reports per-recipient status.

## Migration Plan

1. Rewrite `20260612000000_pulse_schema.sql` (renames + new tables); rebuild local PGlite; commit the migration for the first time.
2. Rename pass through `lib/pulse/` + routes; existing tests green.
3. New code lands behind the schema: phone tier → availability engine → passive flows → broadcast delivery → Who's-Around.
4. Deploy: `supabase db push` (first push of the pulse schema), verify Twilio env vars, WhatsApp unfurl re-check on renamed pages, one real SMS round-trip.
Rollback: nothing pulse-side is deployed today, so rollback is "don't push"; post-deploy, the schema is additive-only from this point (no destructive follow-ups planned).

## Open Questions

- None blocking. Deferred by scope: recipient-timezone quiet hours, SMS opt-out per crew member (v1: leaving the crew is the opt-out; revisit with plans change).

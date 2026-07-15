# Availability & Presence Layer — Design

**Date:** 2026-07-15
**Status:** Approved (brainstorm complete)
**Builds on:** the `add-live-pulse` change (containers/sparks link rail in `apps/web/app/p/`), `design/SYSTEM-THESIS.md`

## Why

Bonfire's next layer answers "who's free?" without anyone being asked. A user declares a standing busy baseline **once** (no calendar required), patches it with occasional exceptions ("off Thursday", "vacation next week"), and the app resolves availability from that coarse signal. The same "I'm free" fact then surfaces through **three deliberately different social pressures**:

1. **Passive (silent).** Baseline + corrections. Never fires a notification. Surfaces only when someone else looks.
2. **Broadcast (active, scoped).** The pulse — a deliberate flare to a chosen audience. The **only** notifying path in the system.
3. **Ambient (pull).** "Who's around this weekend?" — a glance that fires nothing.

This is not a scheduling poll. Answering "am I free?" costs the user zero taps because the app already knows.

Web-first (Partiful-style link rail), mobile later. Domain logic lives in `lib/pulse/` so the eventual Expo app imports it unchanged.

## Decisions made (with rationale)

| Decision | Choice | Why |
|---|---|---|
| Identity | **Phone-first, appless-tolerant** | Consumption (open link, tap status) stays cookie-only and frictionless. Durable acts (declare availability, join/create crew, SMS pulse) require a one-time phone verification via the existing Twilio rail. A standing baseline must survive browser churn; a cookie ghost cannot. |
| Pulse delivery | **Creator-controlled: link-drop and/or direct SMS** | Compose ends in a delivery choice: "Copy message + link" (paste into the group chat — its scope is whoever's in that chat) and/or "Text the crew" (SMS to crew members — its scope is the roster). No "notify everyone" exists anywhere. |
| Existing build | **Evolve, don't rebuild** | `containers` → `crews`, `sparks` → `pulses`, `spark_participation` → `pulse_responses`. The working polling/OG/rate-limit/identity code carries forward. The pulse migration is uncommitted and undeployed, so it is rewritten in place — no rename-migration stacking. |
| V1 scope | **Availability + pulse + ambient; plans deferred** | The plan flow (slots → pre-filled availability → lock → confirm) ships as its own follow-up change on top of a proven availability engine, with its own design pass on the "not a planner" tension. |

## 1. Identity — two tiers on `pulse.participants`

- **Tier 0 (cookie, unchanged):** open a link, see a board, set presence, respond to a pulse. Token-cookie identity, ghosts tolerated, never a hard "already joined".
- **Tier 1 (verified phone):** required for declaring availability, creating/joining a crew, and sending an SMS-delivered pulse. First such act triggers a one-time SMS code (Twilio, reusing the Asker's infra).
- **Schema:** `participants` gains `phone text unique` (E.164) and `phone_verified_at timestamptz`. A short-lived `phone_verifications` table holds pending codes (phone, code hash, expires_at, attempts).
- **Ghost merge:** if a cookie ghost verifies a phone that already belongs to a participant, the cookie is re-pointed to the canonical participant (the ghost's rows are not migrated in v1 — tier-0 activity is ephemeral by design; the canonical row keeps the baseline).
- The viewer's identity is exposed only through server-rendered props / state payloads, never a JS-readable cookie (existing invariant, kept).

## 2. Schema — rewrite `supabase/migrations/20260612000000_pulse_schema.sql` in place

Renames (same shapes unless noted):

- `containers` → **`crews`**. Keeps token, name, version, created_by, archived_at.
- **`crew_members`** (new): `crew_id`, `participant_id`, `joined_at`, PK (crew_id, participant_id). Joining requires tier 1. This is the SMS-delivery roster and the Who's-Around scope.
- `presence` → keyed to `crew_id` (rename column only). Board presence semantics unchanged (`around/busy/away/out` + note, current-only).
- `sparks` → **`pulses`**. Same columns (`title`, `place`, `time_label`, `expires_at`, `closed_at`, `token`, `client_uuid`, `version`). `crew_id` stays **nullable**: null = standalone link-drop pulse; set = crew-scoped (required for SMS delivery). Keep the `unique nulls not distinct (crew_id, created_by, client_uuid)` idempotency key and the partial live index.
- `spark_participation` → **`pulse_responses`**. Keeps the richer `in / on_my_way / here / out` + `eta_minutes` + `note` (strictly better than a bare `in/seen`).
- `events` and `action_log`: kinds/actions renamed to match (`pulse_create`, `pulse_wrap`, …), plus new kinds `phone_verified`, `baseline_set`, `exception_set`, `sms_sent`.

New tables:

- **`availability_baseline`** — `id`, `participant_id`, `days_of_week int[]` (0–6), `start_time time`, `end_time time`, `timezone text` (IANA, captured from the browser at creation), `label text` (≤40), `created_at`. Multiple rows per user allowed. These are **busy** windows ("when are you usually tied up?").
- **`availability_exception`** — `id`, `participant_id`, `state` (`free` | `busy`), `starts_at timestamptz`, `ends_at timestamptz`, `all_day bool`, `label text` (≤40), `created_at`. Exceptions always beat the baseline.
- **`calendar_source`** — `id`, `participant_id`, `provider`, `connected_at`. **Stub only** — no OAuth, no `calendar_busy_block` rows in v1; the resolve path is written but always empty.
- **`sms_deliveries`** — `id`, `pulse_id`, `recipient_participant_id`, `sent_at`, `twilio_sid`, `status`. Dedupe (never text the same person twice for one pulse), quiet-hours enforcement, cost visibility.

Deferred to the plans change: `plan`, `plan_slot`, `plan_availability`, `plan_confirmation`.

Everything stays in the server-only `pulse` schema: no RLS, no PostgREST exposure, all access via the shared `sql()` pool.

## 3. Availability engine — `lib/pulse/availability.ts`

Pure, unit-tested function:

```
resolveAvailability(participantId, startsAt, endsAt)
  → { availability: 'free'|'probably_free'|'busy'|'unknown',
      confidence: 'high'|'low',
      label?: string }
```

Resolution order:

1. **Calendar path (stubbed):** if a `calendar_source` exists, check `calendar_busy_block` overlap → `busy`/`free` at `high` confidence. In v1 this branch exists but no blocks exist, so it falls through.
2. **Exceptions first:** an overlapping `busy` exception → `busy` (with label). An overlapping `free` exception → `free` at `low` confidence (explicit-but-coarse: intentional, so shown as free, but confirm-step still backs it).
3. **Baseline:** window overlaps a recurring busy window (day-of-week + time range, resolved in the viewer-supplied timezone) → `busy` with label; no overlap → `probably_free`, `low`.
4. **Nothing declared, no calendar** → `unknown`. Unknown never blocks anything and never reads as a "no".

Timezone rule (matches the existing spark invariant): the client resolves absolute instants; the engine compares baseline day/time windows in the participant's declared timezone (stored once at baseline creation, `timezone text` on `availability_baseline`).

Color semantics (design system, used consistently everywhere availability renders):

- `free` (high confidence): solid green
- `probably_free` (low confidence): amber / lighter weight
- `busy`: muted grey + label if present
- `unknown`: neutral outline
- Coral `#FF5C3A` is reserved for actions and the pulse flare — never an availability state.

## 4. Flows — three pressures, architecturally separate

### Passive (silent — no notification path exists in this code)

- **OnboardingAvailability:** one question — "When are you usually tied up?" — day + time-range picker writing `availability_baseline` rows. Shown once after first phone verification. Skippable. Deliberately **not** a full editor; corrections happen in the moment. If it feels like configuring Calendly, it's wrong.
- **AvailabilityCorrection:** "I'm free" / "I'm away" quick action → writes an `availability_exception` (date-range support for vacations). Silent toast confirm. No push, no SMS, no event visible to others.

### Broadcast (the only notifying path)

- **DropPulse:** evolves the spark composer. Title/place/time as today, plus optional crew pick. Delivery step (creator-controlled, both allowed):
  - **Copy message + link** — prewritten chat-drop text ("Free tonight — tap in: <url>"). Scope = whoever's in the chat it's pasted into.
  - **Text the crew** — requires a crew; one SMS per `crew_members` row via Twilio, logged in `sms_deliveries`, deduped, quiet-hours-guarded, visually explicit in the UI that it notifies ("This texts the 5 people in NYC crew").
- Pulse pages keep today's participation surface (`in/on_my_way/here/out`, ETA, note, wrap, TTL, OG unfurl, polling).

### Ambient (pull, fires nothing)

- **WhoIsAround:** per-crew view — pick a window (tonight / this weekend / custom); `free`/`probably_free` members render first (green/amber), members with nothing declared render below in the neutral-outline `unknown` state (present, never framed as a "no" or a laggard), and `busy` members render muted with their label. Merged with any live board presence. Tapping someone offers "drop a pulse". Loading the view fires **no** notification and writes nothing but a funnel event.

## 5. Non-negotiable behavior rules (carried into code review)

1. Updating availability never sends a notification. Ever.
2. SMS sends exist in exactly one code path: pulse delivery to a chosen crew. No "notify everyone" option anywhere.
3. Availability ≠ commitment — they will remain separate tables and separate acts when plans land; nothing in this change pre-merges them.
4. No rejection surface: group views accumulate positives; non-response is silent.
5. Coarse is the default; calendar is a stubbed optional upgrade, never required.
6. `unknown` never blocks and never counts as a no.

## 6. Verification

- **Unit (Vitest):** `resolveAvailability` — baseline overlap, exception-overrides-baseline, vacation range, free-exception-over-busy-baseline, unknown, timezone edges (midnight-spanning windows). Identity: verify-code flow, ghost merge re-points cookie. Repo: renamed paths keep the existing idempotency/liveness tests green.
- **Existing suites stay green:** OG, polling/ETag, rate-limit tests, and the untouched Asker suite (`npm run test`, `npm run build:web`, `npm run lint:web`).
- **End-to-end smoke (local PGlite on :5433):** declare baseline → correction → Who's-Around shows the right states; compose pulse → link-drop path yields the message+URL; SMS path logs `sms_deliveries` rows (Twilio mocked locally).
- **Deployed verify:** WhatsApp unfurl still works on renamed routes; one real SMS delivery round-trip.

## Out of scope (this change)

- The plan flow (`plan`, `plan_slot`, `plan_availability`, `plan_confirmation`, IncomingPlan/LockAndConfirm screens) — next change.
- Calendar-provider OAuth and `calendar_busy_block` sync (stub table only).
- Place/venue proximity ranking, MapLibre view, crew formation/matching, AI suggestions.
- Native mobile screens (Expo) — domain layer is written to be portable, screens come later.

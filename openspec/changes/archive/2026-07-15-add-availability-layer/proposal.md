# Add the availability & presence layer — evolve the Live Pulse rail

## Why

The Live Pulse rail answers "what's happening right now on this board?" but nothing answers "who's free?" without someone being asked. This change adds the layer underneath: a user declares a standing busy baseline **once** (no calendar), patches it with occasional exceptions, and the app resolves availability from that coarse signal — surfacing it through three deliberately different social pressures (passive/silent, broadcast/scoped, ambient/pull). Approved design: `docs/superpowers/specs/2026-07-15-availability-presence-layer-design.md`.

## What Changes

- **Phone-first, appless-tolerant identity**: consumption (open link, tap status) stays cookie-only; durable acts (declare availability, create/join crew, SMS a pulse) require a one-time SMS phone verification (Twilio, reusing the Asker rail). Ghost cookies merge into the canonical phone identity.
- **BREAKING (pre-deploy, internal): evolve the `pulse` schema in place** — the uncommitted `20260612000000_pulse_schema.sql` migration is rewritten: `containers` → `crews` (+ new `crew_members` roster), `sparks` → `pulses` (`crew_id` nullable: null = standalone link-drop), `spark_participation` → `pulse_responses` (keeps `in/on_my_way/here/out` + ETA + note). Routes, repo, types, and copy rename to match. Supersedes the object names in the un-archived `add-live-pulse` change; its behavior (OG unfurl, polling/ETag, rate limits, TTL/wrap) carries forward unchanged.
- **Availability engine**: new tables `availability_baseline` (recurring busy windows + timezone), `availability_exception` (free/busy overrides, range support), `calendar_source` (stub only, no OAuth); pure `resolveAvailability(participantId, startsAt, endsAt)` → `{availability: free|probably_free|busy|unknown, confidence, label?}` with exceptions > baseline > unknown ordering. `unknown` never blocks and never reads as a "no".
- **Passive flows (never notify)**: OnboardingAvailability (one skippable question after first phone verify) and AvailabilityCorrection ("I'm free" / "I'm away" quick action, vacation ranges, silent toast).
- **Broadcast flow (the only notifying path)**: DropPulse gains an optional crew pick and a creator-controlled delivery step — "Copy message + link" (chat drop) and/or "Text the crew" (one SMS per member, logged in new `sms_deliveries`, deduped, quiet-hours-guarded, UI explicit about who gets texted).
- **Ambient flow (pull, fires nothing)**: Who's-Around — per-crew view over a chosen window showing resolved availability (green free / amber probably / grey busy-with-label / outline unknown) merged with live board presence; tapping someone offers "drop a pulse".
- **Out of scope**: the plan flow (`plan`/`plan_slot`/`plan_availability`/`plan_confirmation`), calendar-provider OAuth and busy-block sync, proximity/matching, native mobile screens (domain code stays portable in `lib/pulse/`).

## Capabilities

### New Capabilities
- `phone-identity`: two-tier identity — cookie consumption tier, verified-phone durable tier; OTP issue/verify flow, rate limits, and ghost-merge semantics.
- `availability`: declaring the baseline and exceptions, the `resolveAvailability` resolution/confidence/timezone semantics, and the two silent passive flows (onboarding + correction).
- `crews`: the durable crew object evolved from the container — membership roster, join/create gating on the phone tier, and the carried-forward presence board.
- `pulse-broadcast`: the evolved pulse (ephemeral micro-event) plus creator-controlled delivery — link-drop message and/or per-member crew SMS with dedupe, quiet hours, and delivery logging.
- `who-is-around`: the ambient pull view — window picking, availability rendering order and color semantics, no-notification guarantee.

### Modified Capabilities
<!-- None published yet: openspec/specs/ is empty (add-live-pulse was never archived). The live-pulse and pulse-link-unfurl specs inside that change keep describing the on-page/unfurl behavior; the renames here supersede their object names. -->

## Impact

- **Database**: rewrite `supabase/migrations/20260612000000_pulse_schema.sql` in place (uncommitted, undeployed); add `phone`/`phone_verified_at` to `participants`, new tables `phone_verifications`, `crew_members`, `availability_baseline`, `availability_exception`, `calendar_source`, `sms_deliveries`; renamed event/action kinds.
- **Code**: `apps/web/lib/pulse/**` (renames + new `availability.ts`, `phone.ts`, `sms.ts`), `apps/web/app/p/**` (renamed routes + new onboarding/correction/who's-around surfaces), `apps/web/app/api/pulse/**` (renamed + new verify/availability/delivery endpoints).
- **Dependencies**: none new — Twilio SMS reuses the Asker's setup; no client DB keys.
- **Config**: Twilio env vars must be present for OTP + pulse SMS (already set for the Asker in production).
- **Untouched**: the Asker rail, the mobile `public` schema, the OG/polling/rate-limit behavior.

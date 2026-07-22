## Why

A pulse's "when" is two disconnected fields today: a free-text `time_label` string the machine never reads ("8:30pm"), and a fuzzy "stays live for" TTL that is the *only* real timestamp. They can silently disagree, and because nothing records when an event actually *ends*, the pulse never wraps on its own — closing it is a manual **"That's a wrap"** button that sits directly under the here-huddle on the detail page. The result is the reported bug: tapping the personal **"here"** status reads as (or collides with) killing the whole event. Giving a pulse a real start and duration makes the lifecycle self-driving and pulls "wrap" off of "here".

## What Changes

- **One "When" control with two modes: Now / Later.** Replaces the free-text time field *and* the "stays live for" TTL segment.
  - **Now** → the pulse starts immediately; you pick a duration (`1h` / `2h` / `til late`).
  - **Later** → you pick a start (`Today` / `Tomorrow` + a time) and a duration.
- **Two real timestamps replace the label + TTL.** A pulse gains an absolute `start_at` and reuses its existing `expires_at` as the end instant (both resolved from the creator's local wall clock, exactly as `expires_at` is resolved today), plus the creator's IANA `timezone`. The human "when" label ("Now", "Tonight 8:30pm · ~2h") is **derived** from these, so machine time and displayed time can never diverge again. **BREAKING** for the create API payload shape (`timeLabel` + `expiresAt` → `startAt` + `endsAt` + `timezone`).
- **A three-state lifecycle falls out of the timestamps:** *upcoming* (`now < start_at`), *live* (`start_at ≤ now < expires_at`), *over* (`now ≥ expires_at` or closed). A pulse **auto-wraps at its end instant** — no button required.
- **"That's a wrap" becomes a quiet "End early", moved off the here-huddle and confirm-gated,** so tapping "here" can never again read as (or sit adjacent to) ending the event. Its authorization is unchanged (anyone with the link, as today) — no new host-role concept. Wrapping stays idempotent and still yields the made-it summary.
- **`time_label` stops being free-text input.** It becomes a machine-derived display snapshot, written at creation from `start_at`/`expires_at` in the creator's tz, and read unchanged by every downstream surface (dashboard, OG unfurl). Legacy free-text rows keep their existing label untouched.

Out of scope (separate follow-up change): the taggable Mapbox place picker for "where".

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `pulse-broadcast`: the pulse's time model changes from free-text `time_label` + TTL-derived `expires_at` to a machine-resolved `start_at` + `expires_at` (end) + creator `timezone`, with `time_label` demoted to a derived display snapshot; liveness becomes a three-state (upcoming/live/over) lifecycle that auto-wraps at the end instant; manual wrap is reframed as a de-emphasized, confirm-gated "end early" (authorization unchanged).
- `pulse-dashboard`: the liveness split classifies against the new lifecycle (an *upcoming* pulse is active, not "Earlier"); the active section orders by soonest start and labels upcoming pulses with their start time.

## Impact

- **DB / migration** (`supabase/migrations/`): add `pulses.start_at` and `pulses.timezone`; backfill `start_at = created_at` for existing rows. `expires_at` is reused as the end instant (no rename, no new `ends_at` column). `time_label` kept as the display column, now machine-derived for new rows.
- **API**: `POST /api/pulse/pulses` payload (`timeLabel`/`expiresAt` → `startAt`/`endsAt`/`timezone`); `PUT /api/pulse/pulse-wrap` unchanged in contract but reframed in UI.
- **lib**: `lib/pulse/time.ts` (`resolveExpiry` → resolve start + end; new derived-label formatter), `lib/pulse/types.ts` (Pulse + public shapes), `lib/pulse/copy.ts` (`TTL_PRESETS` → duration presets; `ogCopy.pulseDescription` derives from start/end), `lib/pulse/repo.ts` (create + liveness reads), `lib/pulse/serialize.ts`.
- **UI**: `app/p/new/CreateForm.client.tsx` (the When control), `app/p/s/[token]/Pulse.client.tsx` (upcoming/live/over states, "End early" placement, countdown), `app/p/page.tsx` dashboard sections, OG unfurl route.

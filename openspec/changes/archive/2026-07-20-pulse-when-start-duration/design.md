## Context

A pulse's timing today is split across two fields that don't reference each other:

- `time_label` — a free-text string ("8:30pm", "now"), 30-char cap, **never read by the machine**. Pure display.
- `expires_at` — an absolute instant resolved client-side from a "stays live for" TTL preset (`3h` / `6h` / `end of today` / `end of tomorrow`, see `lib/pulse/time.ts` `resolveExpiry`). This is the **only** real timestamp, and it drives everything: `isLive`, the dashboard split, the partial index.

Because nothing records when the event *ends as an event* (only when the *link* goes cold), a pulse never wraps itself. Closing is a manual **"That's a wrap"** button — and on the detail page that button sits directly under the here-huddle, one row below the personal **"here"** status. The two collide: reaching "here" reads as ending the event. This change gives a pulse a real start + end so the lifecycle self-drives and "wrap" stops being load-bearing.

The `expires_at` resolution is deliberately **client-side** (the browser's resolved IANA timezone is the creator's timezone) so "end of day" means the creator's day, not server UTC. This change keeps that discipline for both start and end.

## Goals / Non-Goals

**Goals:**
- One "When" control, two modes (Now / Later), replacing both the free-text time field and the TTL segment.
- A pulse carries a real `start_at` and end instant + the creator's timezone; the display label is derived and can never disagree with the machine.
- A three-state lifecycle (upcoming / live / over) that auto-wraps at the end instant.
- Pull the manual wrap off the here-huddle so it can never be hit accidentally.
- Surgical migration: additive columns, no rename, legacy rows keep working.

**Non-Goals:**
- The taggable Mapbox place picker for "where" (separate follow-up change).
- A host/creator-only authorization model for wrap. Wrap stays link-authorized as today; we fix the collision by placement + a confirm, not by adding an authz concept.
- Reminders / notifications when an upcoming pulse starts (no notifying path is added; SMS rules are untouched).
- Recurring pulses or multi-day events. Max horizon stays "end of tomorrow", as today.

## Decisions

### 1. Reuse `expires_at` as the end instant; add only `start_at` + `timezone`

`expires_at` already means "the instant the pulse stops being live" — which is exactly the event's end. Renaming it to `ends_at` would touch the partial live index, `serialize.ts`, every read in `repo.ts`, and the dashboard SQL for no behavioral gain. **Decision:** keep `expires_at` as the authoritative end column; add `start_at timestamptz` and `timezone text`. The domain/API speaks `startAt` / `endsAt` (endsAt maps to the `expires_at` column) so the public vocabulary reads cleanly while the migration stays additive.

_Alternative considered:_ rename `expires_at` → `ends_at`. Rejected — pure churn across the read path and index for a cosmetic column name.

### 2. Two modes resolve to `{ start_at, expires_at }` in the creator's local wall clock

`lib/pulse/time.ts` grows a `resolveWhen(mode, dur, startPick, now)` that returns both instants, generalizing today's `resolveExpiry`:

- **Now:** `start_at = now`; `expires_at = now + duration`, where `til late` = end of the creator's local day (reuses today's `eod` math).
- **Later:** `start_at` = the picked day (`Today` / `Tomorrow`) + time, resolved as a local wall-clock instant; `expires_at = start_at + duration` (or end of `start_at`'s local day for `til late`).

Duration presets replace `TTL_PRESETS` in `copy.ts`: `1h`, `2h`, `til late`. The default is Now + `2h`.

Guardrail: a `Later` + `Today` pick whose time is already past is rejected client-side with an inline nudge ("pick a later time or Tomorrow"); the create button stays disabled until `start_at > now`. `expires_at > start_at` is enforced the same way (a zero/negative duration can't be produced by the presets, but the resolver clamps as `resolveExpiry` does today).

### 3. `time_label` becomes a derived display snapshot, not free-text input

The create form no longer has a time text input. Instead, at creation the server derives `time_label` from `start_at` / `expires_at` in the **creator's** timezone and stores it — e.g. `Now · ~2h`, `Tonight 8:30pm · ~2h`, `Tomorrow 9pm · til late`. Every existing downstream reader (dashboard cards, `ogCopy.pulseDescription`, the unfurl route) keeps reading `time_label` unchanged, so the blast radius stays small and the OG card is stable across chats/timezones (it's a creation-time snapshot in a fixed tz).

Anything **time-sensitive** — the live/upcoming/over state, the "live for another N min" countdown, the "starts in / at 8:30pm" upcoming label — computes fresh from `start_at` / `expires_at` against `now`, never from the snapshot. So the snapshot going slightly stale (e.g. the word "Tonight" read the next morning) is cosmetic and bounded by the ≤ "end of tomorrow" horizon.

_Legacy rows:_ their existing free-text `time_label` is left untouched and still renders. The backfill only sets `start_at = created_at` (so old pulses read as "started when created", which is true — they were all effectively "now" pulses under the old model).

### 4. Three-state lifecycle; auto-wrap is the primary end

`isLive` stays `closed_at is null && expires_at > now` — an "over" pulse (past end or closed) is exactly today's not-live. What's new is distinguishing **upcoming** from **live** among the not-over pulses, via `start_at <= now`. `lib/pulse/types.ts` gains a small `pulsePhase(pulse, now): 'upcoming' | 'live' | 'over'` helper; public shapes carry `phase` (and keep `live` for back-compat = `phase === 'live'`) plus `startAt`.

Auto-wrap needs no cron: once `now >= expires_at`, `isLive` is already false and the pulse drops out of live lists via the existing partial index — same mechanism that expires pulses today. The manual wrap only exists to end *early*.

### 5. Wrap → de-emphasized, confirm-gated "End early", off the huddle

`PUT /api/pulse/pulse-wrap` keeps its contract and its link-based authorization (v1 "anyone with the link may wrap" is unchanged — no host role). The fix is UI-only in `Pulse.client.tsx`: the wrap control moves out of the here-huddle region into a distinct, muted spot (e.g. a small "End early" affordance in the creator/YOU panel footer), relabeled and gated behind a two-tap confirm so it cannot be triggered by dragging the status slider to "here". The made-it summary on wrap is unchanged.

### 6. Dashboard active section spans upcoming + live

`pulse-dashboard`'s liveness split classified `expires_at > now && closed_at is null` as "Live now". That still holds for the *active* set, but it now includes **upcoming** pulses (not yet started). The active section orders by **soonest `start_at`** (an upcoming pulse starting in 1h sorts above one that started 2h ago is a product choice — we order upcoming-then-live by start ascending so "what's next" leads), and an upcoming card shows its start label instead of a live countdown. Over/closed pulses go to "Earlier" exactly as today. The bounded-query guarantees are unchanged.

## Risks / Trade-offs

- **Payload break for in-flight clients** → The create API changes shape (`timeLabel`/`expiresAt` → `startAt`/`endsAt`/`timezone`). This is a single-surface web app deployed atomically; there are no third-party API consumers. The route validates the new shape and rejects the old one with a clear error rather than silently mis-storing. Mitigation: ship the client and route together.
- **Migration on a live table** → All three schema touches are additive (`ADD COLUMN`, nullable) plus a one-shot `UPDATE start_at = created_at`. No column is dropped or renamed, so old and new code coexist during rollout; rollback is leaving the columns in place. `start_at` becomes `NOT NULL DEFAULT` only after backfill if desired, or stays nullable with reads coalescing `start_at ?? created_at`.
- **Derived-label staleness** → A snapshot label ("Tonight") can read oddly if viewed on a later day. Bounded by the ≤ end-of-tomorrow horizon and never used for any state decision. Accepted.
- **Ordering surprise on the dash** → Mixing upcoming and live in one section could confuse. Mitigation: upcoming cards are visually distinct (start label, no live dot) so the section reads as "what's on" rather than "who's here now".
- **"End early" still link-authorized** → Any viewer can still end a pulse. This is unchanged v1 behavior; the confirm + placement removes the *accidental* path, which is the reported problem. A real host model is deferred as a non-goal.

## Migration Plan

1. Migration `NNNN_pulse_start_at.sql`: `ALTER TABLE pulses ADD COLUMN start_at timestamptz`, `ADD COLUMN timezone text`; `UPDATE pulses SET start_at = created_at WHERE start_at IS NULL`.
2. Deploy `lib/pulse` (`time.ts` resolver + label, `types.ts` phase, `copy.ts` duration presets, `repo.ts` create/read, `serialize.ts` phase+startAt) and the create route (new payload) and client together.
3. Reads coalesce `start_at ?? created_at` so any row the backfill missed is still correct.
4. Rollback: revert the app deploy; the added columns are inert and can stay.

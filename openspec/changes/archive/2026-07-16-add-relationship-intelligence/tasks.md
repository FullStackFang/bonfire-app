# Tasks: Add Relationship Intelligence (Phase 3)

> **Gates resolved (2026-07-16):** co-presence source → **derived read** (over struck plans + crews, no new history table); delivery → **in-app dashboard card, opt-in, frequency-capped** (no push/SMS); scope → **crew-mates only**. Recency is computed from real in-app co-presence, never a scraped address book. See `design.md`. Runs quiet until co-presence history accrues from Phases 1–2 usage.

## 0. Decisions (gate the build)

- [x] 0.1 Co-presence source → derived read (struck-plan co-attendance + crew graph)
- [x] 0.2 Delivery → in-app card, opt-in (off by default), frequency-capped; scope → crew-mates only

## 1. Schema

- [x] 1.1 Migration `supabase/migrations/`: `pulse.reconnect_prefs` (participant_id PK, `enabled` bool default false, `last_shown_at` timestamptz, `muted` uuid[] default '{}', `updated_at`). Co-presence itself is derived — no new history table.
- [x] 1.2 Extend pulse TS types: reconnect prefs + a public "reconnect suggestion" shape (name + days-since or "not yet").

## 2. Recency engine (`lib/pulse/reconnect.ts`)

- [x] 2.1 `staleCrewMates(viewerId, now)` — for each crew-mate, last co-presence = most recent **struck plan both marked the winning option on**; order stalest-first (never-together first). Derived query; no scraped contacts.
- [x] 2.2 `getSuggestion(viewerId, now)` — the stalest non-muted crew-mate, only if `enabled` and outside the cadence cap (`last_shown_at`). Returns name + days-since (or "haven't gotten together yet"), or null.
- [x] 2.3 `setEnabled`, `mute(personId)`, `markShown` prefs helpers.
- [x] 2.4 DB-gated tests: recency from struck plans only; crew-mate scoping (no strangers, no address book); mute + opt-in + cadence gating; never-together surfaces as a candidate.

## 3. API + proactive card

- [x] 3.1 `GET /api/pulse/reconnect` — `{ enabled, suggestion }`; `POST /api/pulse/reconnect` — `{ action: enable|disable|mute|dismiss, participantId? }`
- [x] 3.2 Reconnect card component: opt-in prompt when off; when on + a suggestion exists, "you haven't seen <name> in <N> days" with **Plan it** / **Not now** (mute) / dismiss. Warm, non-guilting copy; credit by name.
- [x] 3.3 Mount the card on the `/p` dashboard home; marks shown (cadence) on render.

## 4. Agentic plan draft (reuses Phase 1)

- [x] 4.1 "Plan it" seeds an intent ("catch up with <name>") and creates a plan via `/api/pulse/plan`; navigate to it. Review-then-share — nothing sent silently.
- [ ] 4.2 (Follow-up, noted) availability-aware timing ("she's free Thursday") — v1 lets the proposer pick times; a later pass reads the person's `availability`.

## 5. Verification

- [x] 5.1 `npm run test` / `lint` / `build` clean
- [x] 5.2 E2E: two crew-mates with a past struck plan → recency shows days-since → opt in → card appears → "Plan it" creates a plan _(validated locally 2026-07-16 with seeded co-presence: card rendered "haven't seen Sarah in 30 days" → Plan it created a plan)_
- [x] 5.3 Guardrails: off when not opted in; crew-mates only (no strangers, no contacts); mute hides a person; no silent messaging; frequency cap respected

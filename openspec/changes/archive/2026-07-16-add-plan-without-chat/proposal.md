# Add Plan Without the Group Chat (Growth Story · Phase 1)

## Why

Phase 1 of the growth story — **"Make plans without the group chat"** — is the wedge: one person states what they want, Bonfire proposes the best time and place, friends open a simple link and pick, and it lands on the calendar without the back-and-forth. It is the most shippable, most story-critical slice of the roadmap, and it maps almost exactly onto capabilities `apps/web` already has on the **Pulse rail** (`/p`): no-account share links with rich previews, phone-OTP identity, ghost-merge. What's missing is the *object* being shared (a plan with candidate options) and the *AI* that proposes those options.

The Asker rail (`/t`) already solved the hard "enough people are in → it's on" half — the strike-at-K vote-and-confirm transaction (`lib/asker/repo.ts`). Rather than rebuild Pulse's identity/link layer inside Asker, Phase 1 is **anchored on the Pulse rail and reuses Asker's vote-and-confirm logic** ported in as plain domain logic (it is not SMS-bound).

See `design/growth-story/ROADMAP.md` for the program and `design/growth-story/conflicts.md` for the conflicts register. **This change is gated by conflict C1** (voting vs. "presence is a statement") — the voting requirement below is written provisionally and must be reconciled with C1 before build.

## What Changes

- New **plan** object on the Pulse rail: an opener states intent → Bonfire proposes candidate time(s) + place(s) → a per-plan, no-account shareable link → invitees pick → the plan **strikes** (confirms) and everyone sees "it's on."
- New **AI proposer**: given the opener's free-text/spoken intent plus circle context (known people, past venues, rough locale), generate a small ranked set of candidate times and places. This is greenfield — no LLM/AI SDK exists in `apps/web` today.
- New **per-plan appless link** at `/p/plan/[token]`: opens straight to value, no account, rich OG unfurl (reusing the Pulse share-link + `opengraph-image` pattern). Optional lightweight phone verification only if the invitee wants a durable identity — never a wall.
- **Ported vote-and-confirm engine**: candidate options + per-invitee picks + a threshold that flips the plan to confirmed, lifted from Asker's strike-at-K logic into `lib/pulse/` as transport-agnostic domain code.
- Confirmed plans surface in the existing Pulse dashboard and can be added to a calendar.

## Capabilities

### New Capabilities

- `plan-coordination`: the plan lifecycle on the Pulse rail — intent capture, AI-proposed candidate options, the no-account shareable link, invitee selection, and threshold-based confirmation ("it's on"), phrased in Bonfire's statement-not-question voice.

### Modified Capabilities

- None committed yet. If confirmed plans need a home in the dashboard beyond a simple list, `pulse-dashboard` gains a delta in a follow-up — kept out of this change to stay focused.

## Non-goals

- **No recurring/ritual cadence** (that's Phase 2+). Phase 1 is opener-initiated, one plan at a time.
- **No presence/who's-around, no map** (Phase 2).
- **No relationship intelligence / proactive nudges** (Phase 3).
- **No SMS dependency.** The Asker cron/Twilio nudge loop is *not* reused; only its vote/confirm logic is ported. Sharing is link-first (paste into the group chat), not app-sent SMS.
- **No new auth wall.** Consumption of a plan link stays phone-free per the `phone-identity` DNA; verification is an optional upgrade.
- **`apps/mobile` untouched.**

## Impact

- `apps/web/app/p/` — new `plan/` routes: opener create flow, `plan/[token]` public link view, confirmation view; `opengraph-image` for the link.
- `apps/web/app/api/pulse/` — new plan endpoints: create/propose (invokes AI), record pick, confirm/strike.
- `apps/web/lib/pulse/` — new `plan` domain module; **ported** vote-and-confirm logic (from `lib/asker/repo.ts` strike-at-K); a new AI proposer module.
- **New dependency**: an LLM SDK in `apps/web` (Anthropic / Vercel AI SDK) — first AI integration in this app. Model + provider chosen in `design.md`.
- **Schema**: new tables in the `pulse.*` schema — `plans`, `plan_options` (candidate time+place), `plan_picks` (invitee selections), reusing `pulse` participants for identity. New migration in `supabase/migrations/`.
- Reuses unchanged: Pulse identity (`lib/pulse/identity.ts`), phone verify (`/api/pulse/verify`), share-link/OG unfurl pattern.
- **Blocked on**: conflict **C1** resolution (see `design/growth-story/conflicts.md`).

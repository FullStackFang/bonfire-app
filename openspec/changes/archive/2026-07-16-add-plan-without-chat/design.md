# Design: Add Plan Without the Group Chat (Phase 1)

## Context

`apps/web` runs two independent rails. **Asker** (`/t`, `/new`, `/join`, schema `asker.*`) is an SMS-first, cron-driven nudge engine: it texts a circle a single proposed time, members reply in/later/out, and when the K-th "in" lands the round **strikes** into an event (`lib/asker/repo.ts` `replyAndMaybeStrike`). **Pulse** (`/p`, `/api/pulse`, schema `pulse.*`, `lib/pulse/*`) is the live front door — the site root redirects to `/p`. Pulse already has: a two-tier identity (httpOnly cookie participant → phone-verified via `/api/pulse/verify`, with ghost-merge), no-account share links with OG unfurls (`app/p/s/[token]`, `opengraph-image.tsx`), and an app-like interactive client. The in-flight `add-phone-signin` and `add-live-pulse` changes both live on Pulse.

Phase 1 of the growth story — intent → AI options → no-account link → invitees pick → confirmed — splits cleanly across the two rails: the *share + identity* half is Pulse's existing strength; the *vote → it's on* half is Asker's. The founder chose to **anchor on Pulse and reuse Asker's engine** rather than rebuild Pulse's identity/link layer inside Asker.

## Goals / Non-Goals

**Goals:**
- A plan object on the Pulse rail with the full opener→propose→share→pick→confirm lifecycle.
- An AI proposer that turns free-text intent + circle context into a small ranked set of candidate times and places.
- A per-plan, no-account link that opens straight to value with a rich unfurl.
- Reuse Pulse identity/verify/OG and a *ported* (not SMS-bound) copy of Asker's strike-at-K confirmation.

**Non-Goals:**
- No recurring cadence, presence, map, or relationship intelligence (later phases).
- No SMS/cron. No Twilio dependency in this change.
- No auth wall on the link. No changes to phone-identity verification semantics.
- `apps/mobile` untouched.

## Decisions

**1. Anchor on the Pulse rail; port Asker's confirm logic as transport-agnostic domain code.**
The plan object, routes, and API live under `app/p/plan/**`, `app/api/pulse/plan/**`, and `lib/pulse/plan.ts`. Asker's strike-at-K transaction is valuable but entangled with SMS sends and the `asker.*` schema; we port the *logic* (options + picks + a threshold that atomically flips state to confirmed) into `lib/pulse/plan.ts` against `pulse.*` tables, with no SMS. Alternative considered: build Phase 1 on the Asker rail and add a per-plan public link there — rejected because Asker lacks the no-account link, OG unfurl, and OTP identity that are the story-critical, already-built parts of Pulse; we'd rebuild more than we'd reuse, and Asker isn't the live front door.

**2. Data model: plan / plan_options / plan_picks in `pulse.*`.**
```
pulse.plans        id, creator_participant_id, intent_text, locale/context jsonb,
                   token (unique, per-plan link), state (proposing|open|struck|expired),
                   confirm_threshold, struck_option_id?, created_at, closes_at
pulse.plan_options id, plan_id, kind (time|place|time_place), starts_at?, venue jsonb,
                   ai_rank, ai_rationale, source (ai|opener)
pulse.plan_picks   id, plan_id, option_id, participant_id (or ghost token),
                   created_at   — one row per (invitee, option) selection
```
Identity reuses `pulse` participants; an invitee who never verifies is a tier-0 ghost participant (already how Pulse tolerates un-verified actors), so picking needs no phone. `plan_picks` is the ported analog of `asker.replies`; the strike threshold is `confirm_threshold` (analog of `k_threshold`). Alternative: reuse `asker.rounds/replies` cross-schema — rejected; it drags SMS assumptions and a single-time-per-round shape into Pulse.

**3. Candidate *options*, not a single time — pending conflict C1.**
The growth story shows a *menu* of times the invitee picks from ("tap the times that work"). That is the multi-option shape this schema supports. **But this is exactly conflict C1** ("presence is a statement, not a question — no RSVP"). This design keeps `plan_options` general so all three C1 resolutions are buildable without a schema change:
- **C1-A (thesis wins):** AI proposes *one* best option; `plan_options` holds a single row; invitees declare "I'm in" (a one-row pick), no ballot, no "can't make any" surface.
- **C1-B (as drawn):** multi-option ballot; invitees pick any subset; opener/threshold locks the winner.
- **C1-C (hybrid):** AI proposes 2–3; invitees tap availability ("when can you," not "will you come"); winner locks; presence at the locked plan is still a statement.
The spec's voting requirement is marked **provisional (C1)**. Build waits on the founder's C1 call; the schema does not.

**4. AI proposer: Anthropic via the Vercel AI SDK, structured output.**
No AI SDK exists in `apps/web` today. Use the **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) with `generateObject` against a strict Zod schema (`{ times: [...], places: [...] }`) so the model returns validated candidate options, never free prose we parse. Default model: `claude-opus-4-8` (per the `claude-api` guidance that cost downgrades are the operator's call, not the implementer's), env-overridable via `PLAN_AI_MODEL` so tuning cost/latency later is config, not code. (Supersedes the earlier `claude-sonnet-5` note.) The proposer requires `ANTHROPIC_API_KEY` in the deploy env; with it unset it silently uses deterministic fallback options — document this in the deploy env alongside `APP_BASE_URL`. The proposer is a pure server module (`lib/pulse/plan-ai.ts`) invoked by the create endpoint; it takes intent text + context (circle members, past `venue` names, coarse locale) and returns ranked options with a short rationale. Alternative: raw Anthropic SDK — the AI SDK's `generateObject` gives schema validation + retry for free and matches the Vercel deployment. **Load the `claude-api` and `vercel:ai-sdk` skills before implementing.**

**5. The link is appless and opens to value; verification is an optional upgrade.**
`/p/plan/[token]` renders the plan for anyone with the link — no account, per phone-identity DNA ("open to value, never a wall"). Picking writes a `plan_pick` under a tier-0 ghost participant minted on first interaction (same pattern as the rest of Pulse). If an invitee wants their pick to follow them / to get updates, they may verify via the existing `/api/pulse/verify` (ghost-merge) — never required. A per-plan `opengraph-image` gives the rich unfurl when the link is pasted into a group chat (reusing `app/p/s/[token]/opengraph-image.tsx` as prior art).

**6. Confirmation ("it's on") is a threshold strike, ported from Asker.**
When picks for an option reach `confirm_threshold`, `strikePlan()` atomically sets `state='struck'` and `struck_option_id`, idempotently (analog of `replyAndMaybeStrike`). No SMS broadcast — the confirmation surfaces in the opener's dashboard and on the link view on next load/poll (Pulse already polls). Copy follows the house voice: statements, credit-by-name, no out-list, no exclamation hype ("it's on — Thu 7pm at Loring Place", "Sarah's in").

**7. Voice and visual come from the Bonfire Design System, not invented.**
Copy obeys the readme's content fundamentals (second person, sentence case, statements-not-questions, curly quotes/em-dashes, no emoji-as-UI, the ember mark as the one glyph). Visuals reuse the growth-story atoms already drawn (chunky-press CTAs, timerows, ember tint on live/selected, no drop shadows, pill/16/20 radii). Note: `apps/web` today uses plain Tailwind, not `ui-tokens`; match the Pulse rail's existing CSS approach (`app/p/pulse.css`) rather than importing the mobile token package.

## Risks / Trade-offs

- **[C1 unresolved blocks the voting requirement]** → Schema and non-voting scaffolding (plan object, link, AI proposer, dashboard surfacing) can proceed; the pick/ballot UI and its spec requirement wait on the C1 decision. Flagged in the proposal and tasks.
- **[First LLM integration in `apps/web` — cost, latency, failure]** → `generateObject` on a per-plan-create path (low frequency, opener-initiated, not per-render). Add a deterministic fallback (a few sensible default slots from context) if the model errors, so create never hard-fails. Cache nothing sensitive.
- **[Ghost picks enable link-forwarding abuse / ballot stuffing]** → Rate-limit picks per token+IP (reuse Pulse's existing rate-limit posture); `confirm_threshold` plus opener visibility bounds impact. Verification remains the durable-identity upgrade path.
- **[Porting Asker logic risks two drifting copies of "strike"]** → Port as a small, well-tested pure function in `lib/pulse/plan.ts`; do not import across schemas. Asker keeps its own. Accepted duplication (different schemas, different transports) over a premature shared abstraction.
- **[Prompt-injection via intent text or forwarded link content]** → Treat opener intent as untrusted; the proposer prompt constrains output to the Zod schema and never executes instructions from intent. No tool access in the proposer.

## Open Questions

- **C1 (blocking):** single "I'm in" statement vs. multi-slot ballot vs. hybrid availability. Founder decides in `design/growth-story/conflicts.md` before the pick UI is built.
- Does a confirmed plan need to appear in `pulse-dashboard` as a first-class card (a `pulse-dashboard` delta), or is a link + opener view enough for Phase 1? Leaning: link + opener view now, dashboard card as a fast follow.
- `confirm_threshold` default: fixed small K (Asker uses 2–4), or "opener + N", or opener-set? Leaning: opener-set with a sane default, since Phase 1 plans are opener-owned.
- Provider/model final pick and budget ceiling for the proposer (confirm against `claude-api` skill at build time).

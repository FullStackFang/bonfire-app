# close-plan-loop — design

## Context

The Pulse rail plan engine (`pulse.plans`, `/p/plan/[token]`, `apps/web/app/api/pulse/*`) shipped in `add-plan-without-chat` with lifecycle `proposing → open → struck | expired`. `struck` is terminal — nothing exists after the gathering happens. `expired` fires unconditionally when `closes_at` passes without a strike, even if people marked availability. Identity is the tier-0 / phone-OTP / ghost-merge model; participants are addressed by the per-plan link, no accounts required. There is no push channel on this rail (no SMS by design) and no background job infrastructure on the pulse side — clients poll.

`design/SYSTEM-THESIS.md` §iv specs the "again" engine (one tap, scoped to the gathering, one-sided stays private, mutual = match). The July 16 interview synthesis independently validated it as the fizzle-killer. This change builds it on the plan object, plus deadline auto-strike.

## Goals / Non-Goals

**Goals:**
- A plan that happened has a post-event surface, and one tap on it creates durable recurrence intent.
- Silence is structurally invisible: no data path can reveal who *didn't* tap.
- Deadlines decide: availability-bearing plans strike at `closes_at` instead of dying.
- Reuse everything: strike atomicity, proposer, tier-0 identity, polling client, house voice.

**Non-Goals:**
- No notifications of any kind (push/SMS/email) — afterglow is discovered on link revisit or dashboard. The Asker-nudge port is a separate future change.
- No standing/auto-spawning recurrence (thesis §iii) — embers store the intent; the cadence engine comes later.
- No `relationship-intelligence` integration — embers become an RI trigger in a follow-up delta, not here.
- No crew objects, no mobile app changes.

## Decisions

### D1 — Lazy on-read transitions, no cron
Both new transitions (`open → struck|expired` at deadline, `struck → completed` after the event) are evaluated **lazily in the plan read path**: a single `resolvePlanState(plan)` helper runs wherever a plan is loaded (page load, API GET, dashboard list) and applies any due transition before returning it.
- **Why**: the pulse rail has no job runner and needs none — nothing must happen at the exact moment (there are no notifications). Polling clients mean reads are frequent. A cron sweep adds infra for zero user-visible gain.
- **Concurrency**: transitions are conditional single-statement updates (`UPDATE … WHERE id = $1 AND state = 'open'`), same idempotent pattern as the existing strike. Two racing readers → one transition, the loser re-reads.
- **Alternative rejected**: Vercel cron sweep — viable later if embers ever need time-triggered behavior, unnecessary now.

### D2 — Deadline auto-strike picks "most availability, then earliest"
At `closes_at` on an `open` plan: if ≥1 selection exists on any option, strike the option with the most availability marks; tie → earliest start time; still tied → lowest option rank. If zero selections exist anywhere, `expired` (unchanged meaning: nobody engaged).
- **Why**: deterministic, explainable in one sentence on the plan page ("locked in at the deadline — Thursday had the most people free").
- The threshold-strike path is untouched; auto-strike is a second door into the same `struck` state and reuses the same atomic strike statement (extended with the deadline condition).

### D3 — `completed` fires at winning-option start + 4h (fallback: strike + 24h)
A struck plan becomes `completed` when the winning option's start time plus a 4-hour buffer has passed — the gathering has plausibly ended and warmth is at peak. If the winning option carries no parseable time, fall back to 24h after strike.
- **Why a buffer**: showing "do this again?" while people are mid-dinner is wrong; 4h is a constant, not config.
- **Alternative rejected**: opener manually marks it done — a coordinator chore, exactly what we're removing.

### D4 — Ember = one row per completed plan, taps as membership
```
pulse.embers      (id, plan_id UNIQUE, intent_snapshot, created_at)
pulse.ember_taps  (ember_id, participant_id, tapped_at, PK(ember_id, participant_id))
```
The ember is created lazily on the **first** tap (no ember row exists for un-tapped plans). `intent_snapshot` copies the plan's intent/activity so the ember survives independently of the plan. Scoping is inherited from the plan (these people, this activity) per thesis §iv — no cross-gathering embers.
- **Eligibility to tap**: participants who marked the winning option on that plan (they were "in"), including the opener and tier-0 participants (their identity is the existing per-link participant row). Enforced server-side.
- **Silence invisible, structurally**: the API never returns eligible-but-untapped participants. A solo tapper sees only their own tap ("you're in for another one"). Names of co-tappers are returned **only once the ember is mutual (≥2 taps)** — one-sided interest is never exposed to anyone, in either direction. Taps cannot be listed by non-tappers.
- **Un-tap**: deleting your tap row is allowed (changed your mind); if it drops below 2, co-tap names hide again.

### D5 — Afterglow is a state of the existing plan page
`/p/plan/[token]` renders the afterglow view when `state = 'completed'`: a warm one-liner crediting the gathering ("that happened — <winning time/place>") and a single button: **do this again?** No other controls, no roster, no photos, no feedback form. After tapping: confirmation + (if mutual) who else is in, + "start the next one" affordance.
- **Why the same route**: the link is already in everyone's chat history and hands; tier-0 participants have no other address. No new URL, no new unfurl work.

### D6 — Mutual ember seeds a plan through the existing engine
"Start the next one" on a mutual ember creates a normal plan via the existing proposer, intent pre-seeded from `intent_snapshot` + co-tapper names ("again: tennis with Dana and Priya"), owned by whoever tapped the button. Nothing is sent to anyone — the creator shares the new link themselves, same as any plan (no-silent-messaging rule from `relationship-intelligence` applies here identically).

### D7 — Schema migration
One new migration (next numeric slot): widen the `plans.state` check constraint to include `completed`, create `pulse.embers` + `pulse.ember_taps` with RLS matching the existing pulse-schema pattern (service-role writes via API routes).

## Risks / Trade-offs

- [Nobody revisits the link after the event → afterglow never seen] → Accepted for v1; the link lives in the group chat and the opener's dashboard shows completed plans. The real fix is the future nudge port ("that happened — again?"), deliberately out of scope. Measure tap-through before building it.
- [Lazy transitions mean dashboards can show stale state if never read] → Any read heals it; there is no consumer of plan state that doesn't go through a read.
- [4h/24h completion heuristics misfire on long or timeless events] → Constants are conservative and only gate when the button appears, not correctness of anything else.
- [Auto-strike surprises an opener who wanted the plan to just die] → The deadline was opener-set and the outcome is the plan working as advertised; copy explains the lock ("locked in at the deadline"). Opener can still ignore it — no obligation surface.
- [Tap eligibility excludes people who came but never marked the option] → Known blind spot; matching Phase-1's data reality (attendance ≈ marked the winning option, same proxy `relationship-intelligence` already uses).

## Migration Plan

1. Apply migration (additive: constraint widen + 2 new tables) — no backfill; existing `struck` plans become completable lazily on next read.
2. Deploy API + UI together (afterglow view + ember endpoints are useless apart).
3. Rollback: revert deploy; tables are additive and inert without the code. Down-migrating the state constraint requires no data fix unless plans already reached `completed` (leave them — re-widen on rollforward).

## Open Questions

- None blocking. (Ember → `relationship-intelligence` trigger and standing-cadence auto-spawn are deliberate follow-ups, noted in the proposal.)

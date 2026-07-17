# Design: Add Relationship Intelligence (Phase 3)

> **Proposal-level design, furthest-out phase.** This captures the shape and the decisions to make, not a build. Phase 3 depends on Phase 2 shipping (for availability/presence signals) and is the most speculative of the three — treat this as intent to be refined when Phases 1–2 are live.

## Context

The growth story's Phase 3 is agentic: notice → suggest → draft → send. Each verb maps to something the prior phases already provide or will:
- **Notice** — needs a *co-presence recency* signal ("42 days since Sarah"). The raw material exists once Phase 1 is used: a plan that strikes records who was in (`pulse.plan_picks` on the struck option), and Phase 2 adds presence overlaps. What's missing is a durable "last together with X" derivation.
- **Suggest** — needs "is X free soon?" → Phase 2's `availability` (baseline + exceptions).
- **Draft** — needs to compose a concrete plan → Phase 1's `plan-ai.ts` proposer + `plan.ts` engine.
- **Send / confirm** — Phase 1's link + strike.

So Phase 3 is mostly *orchestration over existing engines* plus one new signal (recency) and one new surface (the proactive card) — not a from-scratch system.

## Goals / Non-Goals

**Goals:**
- A co-presence recency signal derived from real in-app activity (plans + presence).
- A proactive, opt-in, frequency-capped surface that offers to plan with someone you haven't seen, when they're free.
- An agentic draft that turns "yes" into a sent invite via the Phase 1 proposer.

**Non-Goals:**
- Address-book CRM / contact scraping. Notification firehose. Always-on location. Mobile work (pending surface decision).

## Decisions (and the ones to make)

**1. Co-presence source of truth (C3 is "build as drawn", but recency needs a real source).** "Haven't seen X in N days" requires a record of when you were last *actually together*. Two options:
- **Derived read** over existing data: max over (struck plans you both marked availability for / attended) and (presence overlaps in the same locale). No new table; a query. Simplest to start.
- **Materialized `pulse.copresence`** (`participant_a`, `participant_b`, `last_together_at`, `count`), updated on each strike/overlap. Faster, and the natural home for the thesis' "again" intensity signal later.
Leaning derived-read first, materialize if the query gets hot. Either way, recency comes from *app co-presence*, never imported contacts — that's the line the C3 resolution doesn't cross.

**2. Proactivity delivery + cadence — the trust gate.** A proactive nudge is welcome once and a nag at the wrong frequency. Decisions:
- **Where:** in-app dashboard card (safest, pull-based) vs a push/SMS notification (higher impact, higher annoyance risk). Leaning in-app card first; notification is a follow-up once value is proven.
- **Cadence:** rare and capped (e.g. at most one proactive suggestion per day/few-days), off by default until opted in.
- **Scope:** which relationships qualify — the growth story implies broad ("42 days since Sarah"). Build as drawn, but bias toward people you've actually co-attended with (the recency signal only exists for them anyway), and let the user mute per-person.
This is the make-or-break UX decision; get it wrong and it reads as creepy/naggy.

**3. Agentic draft reuses Phase 1, doesn't reinvent.** On "yes, plan it", seed the proposer's intent from the relationship + a mutually-free window (from availability), get a concrete time+place, create a plan pre-addressed to that person, and send the invite. The draft is a Phase-1 plan with the opener = Bonfire-on-your-behalf and one intended invitee. Confirmation is the existing strike.

**4. Voice.** House voice, warm and low-key — "you haven't seen Sarah in a while" as a soft observation, credit-by-name, never guilt ("you've been neglecting…"). No hype on confirm.

## Risks / Trade-offs

- **[Creepy/naggy]** — the single biggest risk. Opt-in, frequency-capped, per-person mutable, soft language. Ship conservative and loosen from data.
- **[Recency cold-start]** — the signal is empty until people have co-presence history (Phases 1–2 usage). Phase 3 only makes sense after 1–2 have run for a while.
- **[Acting on stale availability]** — "she's free Thursday" can go out of date; the draft should re-check availability at send time and frame the time as a proposal the invitee still confirms, not a fait accompli.
- **[Agentic overreach]** — Bonfire drafting + sending on your behalf must stay a confirmed action ("yes, plan it" → review → send), never silently messaging people.

## Open Questions

- **Co-presence source** (derived read vs materialized table) — Decision 1.
- **Delivery + cadence + scope** (Decision 2) — the trust-gating decision.
- **Surface:** web `/p` (leaning, consistent with Phases 1–2) vs `apps/mobile`.
- Depends on Phase 2 being live; sequence accordingly.

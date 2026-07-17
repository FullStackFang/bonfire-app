# Add Relationship Intelligence (Growth Story · Phase 3 — "Bonfire becomes proactive")

## Why

Phases 1–2 are user-initiated: someone makes a plan, or someone opens the app to see who's around. Phase 3 of the growth story — **"Bonfire becomes proactive"** — flips that: Bonfire notices you haven't seen someone in a while, checks that they're free, and offers to plan it for you, then drafts the details. Product goal: **be indispensable in your social life**. The growth story screens: a morning card *"You haven't seen Sarah in 42 days. She's free this Thursday — want me to plan something?"* → *"How about Thursday, May 22 · 7:00 PM · Buvette?"* → *"Everyone's in."*

This is the most AI/agentic phase and the furthest out. It stands on everything before it: **Phase 1** gives the plan engine + proposer that drafts the details; **Phase 2** gives the availability/presence signals ("she's free Thursday"); and the durable **co-presence record** (who you actually showed up with, accreted from plan strikes and presence) gives the recency signal ("42 days").

Per the founder's direction, `design/SYSTEM-THESIS.md` is non-binding and **conflict C3 resolved to "build as drawn"** (`design/growth-story/conflicts.md`): the recency-based relationship intelligence ("haven't seen X in N days", proactive planning) ships as designed. This proposal builds it, and flags the two things that resolution doesn't waive: a **co-presence source of truth** to compute recency from, and an **opt-in + frequency model** so proactive nudges are welcome, not nagging (see `design.md`).

## What Changes

- **Co-presence recency** — a durable record of when you were last actually together with each person, accreted from Phase 1 plan strikes (who showed) and Phase 2 presence, so "days since we last hung out" is answerable.
- **Proactive suggestion surface** — a periodic card that surfaces someone you haven't seen in a while *when they're free* (using Phase 2 availability), offering to plan something. Opt-in, frequency-capped, easy to dismiss.
- **Agentic plan draft** — on "yes, plan it", Bonfire drafts a full plan (time + place) via Phase 1's proposer, pre-filled with the person and a mutually-free time, and sends the invite — the growth story's "it plans the details for you."
- Confirmation reuses Phase 1's strike ("everyone's in").

## Capabilities

### New Capabilities

- `relationship-intelligence`: proactively noticing relationships that are going stale and offering to act — a co-presence recency signal, a proactive (opt-in, frequency-capped) suggestion surface, and an agentic plan-draft that turns "yes" into a sent invite using the Phase 1 engine.

### Modified Capabilities

- None committed at proposal stage. Implementation will likely touch `pulse-dashboard` (host the proactive card) and reuse `plan-coordination`; deltas drafted during design refinement.

## Non-goals

- **No passive contact-scraping or an address-book CRM.** The recency signal comes from *actual co-presence in the app* (plans you made, presence you shared), not by importing and scoring every contact.
- **No always-on background location** — the availability/presence it reads are the Phase-2 opt-in signals.
- Not a notifications firehose — proactivity is rare, welcome, and off by default until the user opts in.
- No `apps/mobile` work unless the surface decision (design.md) flips it.

## Impact

- `apps/web/app/p/` — the proactive suggestion surface (a dashboard card and/or the draft-review flow).
- `apps/web/lib/pulse/` — a co-presence recency signal (reads plan strikes + presence); the draft flow reuses `plan.ts` / `plan-ai.ts`.
- **Schema** — a co-presence / "last seen together" record (or a derived read over existing strikes + presence). New migration if materialized.
- **Delivery** — decision needed (design.md): in-app card only vs push/SMS notification for the proactive nudge.
- **Depends on** `add-plan-without-chat` (complete) and `add-network-discovery` (Phase 2 — availability/presence signals).
- **Gated on** the co-presence source-of-truth and the opt-in/frequency model (design.md).

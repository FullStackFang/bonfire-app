# Add Network Discovery (Growth Story · Phase 2 — "The Network")

## Why

Phase 1 (`add-plan-without-chat`) is the single-plan wedge: one opener, one link, one confirmed plan. Phase 2 of the growth story — **"See who's around when it matters"** — turns that into a network: you open Bonfire in a place and see *which of your people are around*, then start something spontaneous in a couple taps. Product goal: **increase usage and network density** — the growth story's Toronto screens ("3 friends from Cornell are around this week" → people-nearby roster → "what are you up for" → Bonfire suggests a spot).

This builds directly on what the web Pulse rail already has: crew-scoped presence (`who-is-around`), self-reported `availability` (baseline + exceptions), and — new in Phase 1 — the plan/strike engine and AI proposer. Phase 2 widens presence from *one crew* to *your people in a place*, adds the discovery surface (where-you-are + who's-nearby), and lets a spontaneous "I'm around" converge into a plan by reusing Phase 1's engine.

**Surface: the web Pulse rail (`/p`)** — consistent with Phase 1, and where the presence/availability primitives already live. (See `design/growth-story/ROADMAP.md`; the roadmap's "apps/mobile" note predates Phase 1 landing on web — the open decision is flagged in `design.md`.)

Per the founder's direction, `design/SYSTEM-THESIS.md` is non-binding for this program and **conflict C2 resolved to "build as drawn"** (`design/growth-story/conflicts.md`): the city map and per-person distances ship as designed. This proposal builds them, and flags the one thing that resolution doesn't waive — a real **location-permission + privacy model** is required regardless of the thesis (see `design.md`).

## What Changes

- **Network presence** — presence beyond a single crew: a per-participant "around / here until <when>" signal scoped to a locale, so you can see friends around you who aren't in one specific crew. Extends the existing `pulse.presence` model.
- **Discovery surface** — a "you're in <city>" view + a **people-nearby roster** with proximity (the growth story's map + "2.1 mi" rows). Requires capturing a location signal (C2, build as drawn) behind an explicit permission.
- **Spontaneous coordination** — "what are you up for" (activity chips) + "when" (now / tonight / this week) → **go live** → Bonfire converges the interested people onto a time+place by **reusing Phase 1's proposer + plan/strike engine** (a spontaneous plan is a plan with a short fuse).
- Ties into `availability` (who's actually free) and `who-is-around` (crew presence) rather than a parallel model.

## Capabilities

### New Capabilities

- `network-discovery`: seeing which of your people are around a place, and starting something spontaneous that converges into a confirmed plan — network-level presence, a nearby-people discovery surface with proximity, and activity/time "go live" coordination built on the Phase 1 plan engine.

### Modified Capabilities

- None committed at proposal stage. Implementation will likely touch `who-is-around` (widen from crew-only to network presence) and `pulse-dashboard` (surface "around you"); those deltas are drafted during design refinement, not pre-committed here.

## Non-goals

- **No relationship intelligence / proactive nudges** — that's Phase 3 (`add-relationship-intelligence`).
- **No live GPS tracking or a moving-dots map.** Even building C2 "as drawn," the location signal is a captured/refreshed reading behind permission, not continuous surveillance (design decision, and the pragmatic/legal floor).
- **No `apps/mobile` work** — this stays on the web Pulse rail unless the surface decision (design.md) flips it.
- Not a public/stranger discovery board — this is *your people*, not a network of strangers.

## Impact

- `apps/web/app/p/` — new discovery surface(s) (you're-in-<place>, people-nearby, go-live) alongside the existing `/p/c/[token]/around`.
- `apps/web/app/api/pulse/` — location signal write + nearby read; "go live" reuses the plan create/strike endpoints.
- `apps/web/lib/pulse/` — network-presence reads; a proximity/locale helper; reuses `plan.ts` + `plan-ai.ts`.
- **Schema** — a location/locale signal on presence (coarse or precise per the C2-as-drawn build), and possibly a network-presence table distinct from crew `pulse.presence`. New migration in `supabase/migrations/`.
- **Depends on** `add-plan-without-chat` (plan engine, complete) and the existing `availability` / `who-is-around` capabilities.
- **Blocked/gated on** the location-permission + privacy model (design.md) — the one hard prerequisite the C2 resolution doesn't remove.

# Design: Add Network Discovery (Phase 2)

> **Proposal-level design.** Phase 2 is the next milestone after Phase 1 ships and is testable; this captures the shape and the decisions that need making, not a line-by-line build. Detail is deliberately lighter than `add-plan-without-chat`'s because the location model and surface decision below materially change the build and should be settled first.

## Context

The web Pulse rail already carries the primitives Phase 2 needs: `pulse.presence` (self-reported crew presence — around/busy/away/out), `availability` (baseline recurring busy + one-off exceptions), the `who-is-around` capability (`/p/c/[token]/around`), and — from Phase 1 — `plan.ts` (the plan/options/picks/strike engine) plus `plan-ai.ts` (the proposer). What's missing for the growth story's Phase 2 is (a) presence that spans *your people in a place*, not one crew; (b) a discovery surface that answers "who's around me right now"; and (c) a spontaneous "go live" that converges interested people onto a plan.

## Goals / Non-Goals

**Goals:**
- Network-level presence: see friends around a locale, not just within one crew.
- A discovery surface (you're-in-<place> + people-nearby with proximity).
- Spontaneous coordination that reuses Phase 1's plan engine to converge on time+place.

**Non-Goals:**
- Proactive/relationship intelligence (Phase 3).
- Continuous GPS / live map. Stranger discovery. Mobile-native work (pending the surface decision).

## Decisions (and the ones to make)

**1. Surface — web Pulse rail. ✅ RESOLVED (2026-07-16).** Phase 2 builds on `/p`: the presence/availability primitives are there, and "go live" reuses the Phase 1 plan/strike engine directly. Not `apps/mobile` (that would re-implement the convergence half). Keeps the whole growth-story arc on one app.

**2. Location model — coarse, no GPS. ✅ RESOLVED (2026-07-16).** The growth story's "2.1 mi" distances are **not** built. Instead: **no device geolocation, no precise distances.** Presence is coarse and self-reported — a participant marks "I'm around" with a rough window (now / tonight / this week) and an optional **self-set locale** (a city/neighborhood string they type, e.g. "Toronto", "West Village"). The roster shows names + a coarse signal ("free tonight", "around this week"), never a distance. This walks C2 back toward thesis DNA #4 ("status, not surveillance") by choice — lowest privacy risk, no permission prompt, still answers "who of my people are around." Visibility is friends/crew-overlap only, never public. (See updated `design/growth-story/conflicts.md` C2.)

**3. Network presence — a new signal beside crew presence.** `pulse.presence` is keyed on `(crew_id, participant_id)`; network presence ("I'm around this week") isn't crew-scoped, so it's a separate `pulse.around` signal: `participant_id`, an optional self-set `locale` (text, no device location), and `around_until` (the coarse window resolved to an instant — tonight/this-week), `updated_at`. The discovery read = participants who **share a crew** with the viewer (the friend graph the Pulse rail already has) and have a live `around_until`. Optionally cross-referenced with `availability` to prefer people who are actually free. No location reading column — the coarse decision (Decision 2) means there's nothing precise to store.

**4. Spontaneous "go live" = a short-fuse plan.** "What are you up for" (activity chips) + "when" (now/tonight/this week) creates a plan via the **existing Phase 1 endpoints**: the activity+window seeds the intent, the proposer suggests a spot, interested people mark availability, and the strike converges it — exactly Phase 1's engine with a tighter `closes_at` and a spontaneous framing. Little new backend; mostly a new entry surface. This is why Phase 2 belongs on the same rail as Phase 1.

**5. Voice/visual.** Same Bonfire design system (`bp-*`, house voice, statements-not-questions, credit-by-name, no shaming/out-lists). The map/roster reuse the growth-story atoms.

## Risks / Trade-offs

- **[Location privacy]** — largely dissolved by the coarse/no-GPS decision (Decision 2): no device location captured, no distances shown, presence is friends-only and self-reported. The residual concern is only that "I'm around" is visible to crew-overlap — acceptable and opt-in (you choose to mark around).
- **[Cold-start density]** — "who's around" is empty until enough friends share presence in one place. The growth story assumes density (Cornell/one NYC neighborhood beachheads, per the thesis). Phase 2 should ship where density exists, not broadly.
- **[Scope creep into a social map]** — keep it *your people* (crew-overlap), not a discovery feed of strangers.

## Open Questions

- Both gating decisions are resolved (surface → web `/p`; location → coarse/no-GPS). Remaining: whether the discovery read should require an `availability` "free" check or just a live `around_until` (leaning: `around_until` primary, availability as a secondary sort). Decide at build.

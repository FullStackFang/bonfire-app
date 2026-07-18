## Why

The 2026-07-16 consumer interview study produced ~10 distinct product directions (six mentor ideas + four proposed mechanics), sorted by how the interview data validates them. Several are **already built** and were validated after the fact (the "Again?" tap, repetition mechanics, deliberation caps); others are **validated-but-unbuilt** (coordinator succession, arm-the-curators distribution), one is **validated only inverted** (event aggregation → heat-map), and two should be **parked** (B2B conferences, ongoing concierge). Right now that triage lives only in a meeting-notes doc — there is no durable, versioned place that says, per insight, *what we decided, whether it's built, and where the evidence is*. Without one, validated-but-unbuilt insights silently decay (the study's own "fizzle" finding, applied to our roadmap), and already-built wins aren't credited against the research that validates them.

## What Changes

- Introduce a durable, versioned **insight register** (`design/growth-story/INSIGHT-REGISTER.md`) — a program-level companion to `ROADMAP.md` that records external research insights, one row per insight, each with a stable ID, verdict, build status, and an evidence pointer.
- Seed it with the 2026-07-16 interview study: all six mentor directions and four proposed mechanics, each cross-referenced to the existing spec / code / roadmap phase that satisfies it (or marked unbuilt).
- Define a lightweight **maintenance convention**: the fixed status vocabulary, when the register is updated, and how a `BUILD-NEXT` insight is promoted into its own OpenSpec change (via `opsx:propose`) — so the register triages and *tracks*, it does not itself implement.
- Add a one-line pointer from `ROADMAP.md` to the register so the program roadmap and the research that backs it stay linked.
- **Out of scope:** implementing any unbuilt insight. This change only creates the tracking artifact and its upkeep rule; promoting a `BUILD-NEXT` item to a real build is a separate future change.

## Capabilities

### New Capabilities
- `insight-register`: a durable, versioned register of external research insights, each carrying a stable ID, a verdict, a build status from a fixed vocabulary, and an evidence pointer; plus the convention for keeping it current and promoting build-next items into OpenSpec changes.

### Modified Capabilities
<!-- None. No existing spec's requirements change; this adds a tracking artifact and cross-references existing specs as evidence. -->

## Impact

- **Docs**: new `design/growth-story/INSIGHT-REGISTER.md`; a one-line cross-reference added to `design/growth-story/ROADMAP.md`.
- **Cross-references (read-only)**: the seeded rows point at existing specs — `again-engine`, `relationship-intelligence`, `who-is-around`, `plan-coordination`, `network-discovery`, `crews` — and code (`apps/web/lib/pulse/ember.ts`, `Reconnect.client.tsx`, `/p/around`). No spec or code is modified.
- **Schema / API / dependencies**: none. This is a documentation + process change only.
- **Process**: establishes that future external research (interviews, studies) lands as rows in this register, and that `BUILD-NEXT` rows are the queue `opsx:propose` draws from.

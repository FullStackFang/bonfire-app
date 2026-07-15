# Add pulse dashboard

## Why

Today the only way back to a crew or pulse is the chat link itself — lose the message, lose the thing. Every returning visit starts at a dead end (`/p/new` can only create). Partiful solved this with a "Your Events" home keyed to your phone number: open the app, see everything you're hosting or going to, tap back in. The pulse rail already has the identity pieces (device cookie for Tier 0, phone verify + ghost-merge for Tier 1 from `add-availability-layer`) but no surface that uses them to answer "what am I part of?"

## What Changes

- New **dashboard page at `/p`** — the home of the pulse rail. Server-rendered from the viewer's cookie identity; shows everything the participant is part of:
  - **Live now**: pulses that are live (`closed_at is null`, unexpired) where I responded or that I created, with my response status and crew context.
  - **Your crews**: crews I'm a member of (`crew_members`) or have board presence in, with my current status.
  - **Earlier**: recently wrapped/expired pulses (capped), quiet and grey — history, not guilt.
- **Empty/recovery state**: a fresh device (no cookie, or a cookie with nothing) sees "Start something" plus a phone-verify entry point ("Been here before?") that reuses the existing OTP flow — verifying re-points the cookie to the canonical participant (ghost merge) and the dash fills in.
- **Way back home**: the BONFIRE brand row on crew/pulse pages links to `/p`.
- New repo reads: crews-for-participant and pulses-for-participant (created ∪ responded), plus a `dash_view` funnel event.
- No new tables; queries run on existing PKs/FKs (`crew_members`, `presence`, `pulse_responses`, `pulses.created_by`).

## Capabilities

### New Capabilities

- `pulse-dashboard`: the participant-scoped home — what appears in each section, ordering, liveness rules, the empty/recovery state, and privacy bounds (only my own memberships/responses; never another participant's roster leaked through the dash).

### Modified Capabilities

- `phone-identity`: adds a requirement that verification is reachable from the dashboard's recovery entry point (not only from crew join / durable acts) and that a successful verify immediately reflects recovered crews/pulses on the dash.

## Impact

- **Routes**: new `apps/web/app/p/page.tsx` (dash, server component, `force-dynamic`, `noindex`); brand-row link edits on `/p/c/[token]`, `/p/s/[token]`, `/p/new`.
- **Domain**: `apps/web/lib/pulse/repo.ts` (two new read queries + tests), `serialize.ts` (dash payload shapes), `copy.ts` (dash strings).
- **Identity**: reuses `identity.ts` viewer resolution and the `add-availability-layer` verify flow (`verify.client.tsx`); no changes to cookie or OTP mechanics.
- **Schema**: none structural; add `dash_view` to the `pulse.events.kind` CHECK in the still-uncommitted `20260612000000_pulse_schema.sql` (rewritten in place per the pivot convention).
- **Dependencies**: none new. Depends on `add-availability-layer`'s verify flow being present (it is, in-tree).

# Design — add-pulse-dashboard

## Context

The pulse rail has three surfaces (`/p/new`, `/p/c/[token]`, `/p/s/[token]`) and zero memory: the chat link is the only way back. Identity already supports this feature — `pulse_pid` cookie (Tier 0), phone verify + ghost-merge (Tier 1, from `add-availability-layer`), and the schema has every row needed to answer "what am I part of" (`crew_members`, `presence`, `pulse_responses`, `pulses.created_by`). Partiful's equivalent is the phone-keyed "Your Events" home: upcoming and past, hosting and going, one tap back into anything. That is the model — adapted to Bonfire's vocabulary (live/wrapped, dropped/tapped-in) and its no-guilt content rules.

## Goals / Non-Goals

**Goals:**
- One page, `/p`, that shows a returning participant their live pulses, their crews, and a short quiet history — server-rendered from the cookie, zero taps to see it.
- A recovery path for a new device: verify phone → cookie re-points to the canonical participant → dash fills in (the Partiful "enter your number, get your events back" move).
- Every crew/pulse page links back home, so the dash is reachable from anywhere on the rail.

**Non-Goals:**
- No live polling on the dash (it is a launchpad; freshness lives on the crew/pulse pages).
- No management actions from the dash (no wrap/leave/archive/delete here) — tap through to the object.
- No pagination beyond a fixed "Earlier" cap; no search; no crew discovery.
- No availability/Who's-Around content on the dash (owned by `add-availability-layer`).

## Decisions

1. **`/p` is the dash route.** It currently 404s (only the layout exists), it inherits `pulse.css`/fonts for free, and it makes the URL hierarchy read naturally: `/p` = mine, `/p/c/*` = a crew, `/p/s/*` = a pulse. Alternative — `/p/me` — adds a segment for nothing; `/` stays the map prototype until that decision is made separately.

2. **Server component, no client state.** The page awaits `getViewer()` and two repo reads, renders sections, done (`force-dynamic`, `robots: noindex`, same as siblings). No zustand, no poll hook, no state endpoint, no ETag — the dash is read-once. Alternative (poll like the board) rejected: three sections × N objects would need a composite version key for 304s; cost without user value.

3. **Two repo reads, both bounded.**
   - `crewsForParticipant(pid)`: crews reachable via `crew_members` ∪ `presence`, `archived_at is null`, left-joined to my presence row (status/note) — ordered by my latest activity. Membership and presence are both "part of": presence predates the roster table, and a Tier-0 tapper has presence but no membership.
   - `pulsesForParticipant(pid, now, limit)`: pulses where `created_by = pid` ∪ a `pulse_responses` row of mine exists; left-join crew name; my response status; split live (`closed_at is null and expires_at > now`, soonest-ending first) from earlier (most recent first, cap ~10). All joins ride existing PK/FK indexes; both queries are single round-trips.

4. **Recovery reuses `VerifySheet` verbatim.** The dash renders a small client island: "Been here before? Verify your phone" → existing OTP sheet → on `onVerified`, `router.refresh()` re-renders the server dash under the adopted (merged) identity. No new API, no new identity code. The island only shows when the dash is empty or the viewer is unverified — a verified participant with content sees no identity chrome at all.

5. **Partiful vocabulary, Bonfire rules.** Hosting/going becomes "dropped by you" (creator credit, named and warm) vs the response pill (`in / on my way / here`); upcoming/past becomes LIVE NOW / EARLIER. Content rules carry over: earlier items are grey and quiet (history, never a flake record), numbers are typeset not chipped, `out` responses simply don't appear in EARLIER framing as anything negative.

6. **Funnel: `dash_view`.** Added to the `pulse.events.kind` CHECK by rewriting the uncommitted `20260612000000_pulse_schema.sql` in place (established pivot convention); logged on non-crawler dash render with `participant_id`.

## Risks / Trade-offs

- [Stale dash after a wrap/expiry elsewhere] → acceptable: every tap-through lands on a live page; the dash re-renders on every visit (`force-dynamic`, no-store).
- [Ghost rows: history created under an orphaned cookie is unreachable from the merged identity] → accepted, consistent with the ghost-merge design; verify early is the mitigation, and the recovery entry point encourages exactly that.
- [Unbounded crew list for a power user] → crews are cheap rows and realistically few; only EARLIER is capped. Revisit if telemetry disagrees.
- [`union` queries drifting from the partial index] → the live-pulse filter reuses the same predicate as `activePulsesForCrew` (`closed_at is null`), and the dash query is per-participant, not per-crew hot path; repo tests pin the liveness split.

## Migration Plan

Schema delta is one CHECK-constraint value in a migration that has never been pushed (`supabase db push` is still pending from `add-availability-layer` task 8.3) — rewrite in place, local PGlite re-applies on boot. No deploy ordering concerns; the page ships dark until linked.

## Open Questions

- Should `/` (map prototype) redirect to `/p` once the dash exists? Leaning yes, but that decision belongs to the owner — flagged in tasks as optional.

# add-restaurant-pods

> Source design: Claude Design project "Bonfire Design System" → `ui_kits/pulse_link/restaurant-pods.html` (6-screen workflow, imported 2026-07-22). "Pod" is a **provisional name** — the UI copy ships behind a single copy constant so a rename is one-line.

## Why

The open-invite-to-a-restaurant case is the first pulse use where the *venue* imposes constraints: a reservation needs an accurate headcount by a deadline, a table has a cap, and rides need sorting. Today a pulse has no party size, no headcount facts, and no sub-group primitive — the note field is the only escape hatch, and reservation math happens back in the group chat the pulse was supposed to replace.

## What Changes

- **Venue facts at create (optional):** a pulse can carry a seats cap ("table for 12") and a "count needed by" cutoff instant. Both are facts about the venue, never a gate on people. Creation-time only in v1 — no post-create editing.
- **Party size on responses:** an "in" response can carry +N guests (0–3). The pulse view shows a headcount meter ("11 in · party of 14 · 14 of 12 seats"). Over-cap is **soft overflow** — a passive in-view line ("2 over the table"), never a hard stop, waitlist, or notification.
- **Count snapshot at cutoff:** when the cutoff passes, the headcount *number* locks as a snapshot for the reservation ("Headcount locked · 14"). The door does not lock — late joins still work and render as "after the count." An egalitarian anyone-can-tap "table called" toggle records that someone phoned the restaurant.
- **Pod primitive (provisional name):** a pulse can host pods — label + kind (`car` / `walk` / `meetup` / `other`) + optional seat capacity + owner + tap-to-join members. Anyone with the link can open one (no host role). Pod capacity is a physical fact (a car has seats): full pods stop accepting joins.
- **Day-of context:** the live pulse groups on-my-way ETAs by pod ("Dana's car · 10 min out · ~4 people"), derived read-time from members' existing statuses.

Explicitly **not** changing: no new notification paths (pulse-broadcast SMS remains the only one), no host role, no RSVP submit step (one-tap `in` preserved; party size is an optional follow-up), wrap/lifecycle mechanics untouched.

## Capabilities

### New Capabilities
- `pulse-pods`: the sub-group primitive on a pulse — open, join, leave, seat caps, day-of ETA grouping, and its privacy bounds.

### Modified Capabilities
- `pulse-broadcast`: pulse creation gains optional venue facts (seats cap, count-needed-by cutoff); responses gain party size; the count-snapshot-at-cutoff and table-called behaviors attach to the pulse lifecycle.

## Impact

- **DB:** two nullable columns on `pulses` (`seats_cap`, `count_needed_by`), `party_size` on `pulse_responses` (default 0), `table_called_at` on `pulses`, new tables `pulse_pods` + `pulse_pod_members` (one migration).
- **API:** create route accepts venue facts; state/respond routes accept `partySize`; new pod endpoints under `/api/pulse/pulses` scope; serialize shapes extend `PublicPulse` (headcount block, pods array) — same no-leak discipline (no phones, no absence surfacing).
- **UI:** `CreateForm.client.tsx` (two new optional fields), `Pulse.client.tsx` (party-size chips, headcount meter, pods section, day-of grouping) at both breakpoints, `/p/s/preview` updated so the workflow is reviewable without DB writes.
- **Copy/design guardrails:** no flame iconography outside the hero; default copy avoids "crew" for pod labels; no "RSVP" wording anywhere.

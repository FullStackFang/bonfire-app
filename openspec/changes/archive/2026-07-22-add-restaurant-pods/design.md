# Design — add-restaurant-pods

## Context

The pulse (`apps/web`, `/p` rail, schema `pulse.*`) is a live micro-event: link-drop, no-account join, one-tap statuses (`in / on_my_way / here / out`), ETag polling, auto-wrap at `expires_at`. It has no headcount facts, no party size, and no sub-groups. The source design (`ui_kits/pulse_link/restaurant-pods.html`) adds three layers — venue facts, party size, pods — all pulse-shaped and all optional.

Doctrine constraints this design must not break:
- `pulse-broadcast` is the **only notifying path** in the system. Nothing here sends anything.
- **No host role** (wrap is egalitarian; pulses stay symmetric). Venue facts are set at creation only in v1.
- **One-tap join** stays one tap. No RSVP submit step; "RSVP" never appears in copy.
- Serialize discipline: no phones, no absence surfacing, viewer-own-standing-only where applicable.
- Copy/motif: one fire only (no flame icons outside the hero); "pod" is provisional and must be centralized in `lib/pulse/copy.ts`.

## Goals / Non-Goals

**Goals:**
- A pulse can carry a seats cap + count-needed-by cutoff, both optional and inert when unset.
- "In" responses carry 0–3 guests; the view computes and shows the reservation number.
- Cutoff produces a **count snapshot**, not a closed door; "table called" is an anyone-can-tap toggle.
- Pods: open / join / leave / full, with day-of ETA grouping derived read-time from existing statuses.
- Everything works appless (tier-0) at both breakpoints, previewable via `/p/s/preview`.

**Non-Goals:**
- No waitlist, hard cap, or join blocking at the pulse level.
- No notifications, SMS, or "nudge" sends of any kind.
- No post-create editing of venue facts (revisit after usage evidence).
- No pod chat/threads; the pod label + existing note field carry all free text.
- No plan-rail (`/p/plan`) involvement — this is purely a pulse-rail change.

## Decisions

**D1 — Venue facts as nullable columns on `pulses`, not a side table.**
`seats_cap int`, `count_needed_by timestamptz`, `table_called_at timestamptz` — three nullable columns. A side table buys nothing for 1:1 facts. All three null ⇒ exactly today's pulse; zero behavior change for existing rows (migration is pure ADD COLUMN).

**D2 — Party size is `party_size int NOT NULL DEFAULT 0` on `pulse_responses`, guests are counts, not people.**
Guests never become participants, never appear in the roster as rows, never get statuses. Headcount = Σ(1 + party_size) over non-`out` responses, computed in the read query. Alternative (ghost participant rows) rejected: it would leak into every roster/serialize path and violate the identity model. Party size only counts while status ≠ `out` — flipping to `out` removes the whole party from the number.

**D3 — Count snapshot is computed, not stored.**
"Locked at 14" = headcount over responses whose `updated_at <= count_needed_by`, evaluated read-time (same trick as `pulsePhase` — no cron, no snapshot write). Late joiners still respond normally; serialize splits them into `afterCount`. Alternative (write a snapshot row at cutoff) rejected: needs a trigger/cron, and the read-time version is idempotent and testable.

**D4 — Pods are two tables mirroring the response pattern.**
```
pulse_pods:        id, pulse_id, kind ('car'|'walk'|'meetup'|'other'),
                   label (capped), seats int NULL, owner_participant_id,
                   created_at
pulse_pod_members: pod_id, participant_id, joined_at   (PK: pod_id+participant_id)
```
One pod per participant per pulse (unique index on pulse_id + participant_id via membership): you're in one pod at a time; joining another moves you (upsert-style, same as status changes). Owner is a member by construction. Seats NULL = uncapped (walk/meetup). Join is refused only when `seats` is set and full — capacity is a physical fact, the only hard limit in this change.

**D5 — Pod authorization is link-scoped and egalitarian, with two asymmetries.**
Anyone with the pulse link + a participant identity can open a pod or join one. Only the **owner** can edit label/seats or delete the pod (deleting disbands it; members just fall out — no notification). Only **yourself** can be removed by you (leave). This mirrors wrap's "anyone can act" spirit while preventing drive-by vandalism of someone's car offer.

**D6 — Day-of grouping is a pure serialize join.**
`PublicPulsePod` carries members' display names + each member's existing status/ETA; the client renders "10 min out · ~4 people" from the owner's (or min) `on_my_way` ETA and member count. No new state, no new polling — pods ride the existing ETag poll on the pulse state endpoint (pod writes bump the pulse `version`).

**D7 — API shape: pods live under the existing pulse state, writes get two routes.**
Reads: extend the existing `/api/pulse/s/[token]/state` payload (headcount block + `pods[]`) — one poll, no fan-out. Writes: `POST /api/pulse/pod` (create/edit/delete, owner-checked) and `POST /api/pulse/pod-member` (join/leave), matching the flat verb-route convention (`pulse-response`, `pulse-wrap`).

**D8 — "Pod" is provisional: one copy constant.**
All user-visible instances render from `copy.ts` (e.g. `POD_NOUN = 'pod'`), so the rename (circle/camp/wave/…) is a one-line change. Table/column names keep `pod` regardless — renaming DB objects later isn't worth it.

**D9 — Design deviations from the mock (intentional):**
- Screen 2's "Send my RSVP" button → not built. One-tap `in` (optimistic, as today), then an inline "anyone with you?" chip row (`Just me / +1 / +2 / +3`) that PATCHes party size.
- Screen 3's "Bonfire will nudge someone…" → passive copy only: "2 over the table — someone should call the restaurant."
- Screen 6's "table called ✓" → the D1 toggle, tappable by anyone, idempotent.
- Flame icon on the create CTA → existing create-form styling unchanged.

## Risks / Trade-offs

- [Party-size gaming / stale guests] Someone taps +3 and forgets → the count is wrong. → Mitigation: the party chip stays visible-and-editable on your own row; the meter legend separates "N people · +M guests" so inflation is legible. Accepted: this is group-chat-honesty territory, not enforcement territory.
- [One-pod-at-a-time surprises] A person in "Dana's car" tapping "Join" on the walking pod silently moves them. → Mitigation: optimistic UI shows the move immediately on their own screen; copy says "moved to…". Alternative (allow multi-pod) rejected — seats math breaks.
- [Owner deletes a full pod day-of] Members lose their ride context with no notice (no notification path exists, by design). → Accepted: same trust model as wrap-by-anyone; the roster and note field still exist.
- [Read-time snapshot drift] A pre-cutoff responder edits party size *after* cutoff → D3 recomputes over `updated_at`, so their edit moves them into `afterCount`. Trade-off accepted and specced (the snapshot reflects who was counted **as of** cutoff; editing after re-dates you). Simpler than column-level edit history.
- [Scope creep toward host tools] Cap/cutoff invite "creator dashboard" asks. → Non-goal fence in v1; revisit only with usage evidence.

## Migration Plan

One migration (`pulse_restaurant_pods`): three ADD COLUMNs on `pulses`, one on `pulse_responses`, two CREATE TABLEs + indexes. All additive/nullable — existing rows and clients are unaffected; deploy order (DB → app) is safe because the app treats null facts as "feature off." Rollback = revert app; columns/tables sit inert.

## Open Questions

- Final noun for "pod" (circle / camp / wave / …) — deliberately deferred; D8 makes it cheap.
- Whether +3 is the right guest ceiling (mock shows chips to +3; a stepper could allow more). Shipping chips-to-+3; revisit if real parties exceed it.

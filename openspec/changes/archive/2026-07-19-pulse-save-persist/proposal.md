## Why

Anyone can create a pulse or join one anonymously (tier-0 cookie identity), but nothing ever invites them to attach a phone — so their stuff is trapped on one device and silently lost when the cookie is. Partiful solves this with a soft "Sign up to save your event" nudge at the create/RSVP moment; the phone *is* the account and everything persists across devices. We want the same encouragement-and-persistence pattern on the Pulse rail, without gating the frictionless create/join that the system thesis treats as sacred.

Critically, the persistence half is not just UI: today verifying a phone that already has a canonical identity performs a **ghost merge** that re-points the device cookie and **abandons the anonymous row** (`phone-identity` spec: "The ghost row's tier-0 activity is not migrated"). Since Partiful's flow *creates anonymously, then verifies*, a pulse a user just made would vanish the moment they "save" it. The nudge is only honest if the merge carries their work forward.

## What Changes

- Add a **skippable "Save your pulse" step** to the pulse delivery screen (after "Drop the pulse"): Name (if unset) + phone → 6-digit code, with Partiful's privacy reassurance. The existing copy-link / open actions demote to a quieter "or just grab the link" escape.
- Add a **single soft "Save your spot" line** on the pulse detail after an anonymous guest sets their first status. It opens the same verify flow and is dismissible. The status tap itself stays ungated.
- **Ghost merge now migrates the anonymous device's footprint** — the ghost participant's created pulses (`pulses.created_by`) and pulse responses (`pulse_responses.participant_id`) are reassigned to the canonical participant, deduping responses where the canonical already responded. Reassignment scope is pulses + responses only.
- Reuse the existing `useVerifyFlow` hook and ghost-merge machinery; no new verification transport, no new gate. Create and join remain usable with cookie-only identity.
- Dash "Been here before?" recovery and the nav "Log in" chip are unchanged in behavior (at most light copy alignment).

## Capabilities

### New Capabilities
- `pulse-save-prompt`: The Partiful-style, always-skippable encouragement to attach a phone after an anonymous create or join — the "Save your pulse" delivery step and the "Save your spot" guest-join line — so the actor's work persists across devices. Never gates the underlying act.

### Modified Capabilities
- `phone-identity`: The ghost-merge requirement changes from abandoning the tier-0 ghost's activity to **migrating the ghost's created pulses and pulse responses** onto the canonical participant, so a pulse created anonymously survives "saving" it with a number that already exists.

## Impact

- **Code**: `apps/web/app/p/new/CreateForm.client.tsx` (delivery-state save step), `apps/web/app/p/s/[token]/Pulse.client.tsx` (guest-join save line), `apps/web/lib/pulse/phone.ts` (`finalizeVerification` migration on merge), `apps/web/lib/pulse/repo.ts` (reassignment query with response dedupe), `apps/web/lib/pulse/copy.ts` (`authCopy` save-prompt strings). Reuses `apps/web/app/p/verify.client.tsx`.
- **Data**: No schema change. A merge now issues `UPDATE`s on `pulse.pulses` and `pulse.pulse_responses` (PK `pulse_id, participant_id`, so response conflicts must be resolved, not upserted).
- **Behavior**: Verification remains an offer everywhere, never a requirement for create/join/respond (honors `phone-identity`'s "Consumption never requires a phone").
- **Out of scope**: migrating crews/plans/availability on merge (verify-first, so an anon device won't hold them); any persistent "unsaved" nav badge.

## Context

The Pulse rail (`apps/web/app/p`) runs on two-tier identity (`phone-identity`). A tier-0 participant is a random httpOnly cookie (`pulse_pid`); a tier-1 participant additionally has `phone_verified_at`. Anonymous participants can already create standalone pulses and respond to pulses — `resolveOrCreateParticipant()` mints the identity on first write. Nothing prompts them to attach a phone, and the only existing identity chrome is the dash "Been here before?" recovery island (recover-onto-this-device), plus the crew-create verify gate.

Two facts drive this design:

1. **Verification order is inverted from crews.** Crews verify-then-create, so the acting identity is already canonical before any row is written. Partiful's save pattern is create-anonymously-then-verify, so the row already carries the ghost `created_by`/`participant_id` when verification happens.
2. **Ghost merge currently orphans.** `finalizeVerification` (`apps/web/lib/pulse/phone.ts`) has two branches: no canonical row for the phone → `setPhoneVerified` upgrades the ghost *in place* (footprint follows, `merged:false`); canonical row exists → returns the canonical participant and the route re-points the cookie (`adoptParticipant`), abandoning the ghost (`merged:true`). The spec today codifies this: "The ghost row's tier-0 activity is not migrated." Under create-then-verify, the merge branch silently loses the just-made pulse.

## Goals / Non-Goals

**Goals:**
- Offer a skippable, Partiful-style phone-save at the two anonymous-commit moments (pulse delivery, guest join) that reuses the one verify flow app-wide.
- Make the save honest: a pulse/response created anonymously survives verification, including the ghost-merge branch.
- Change nothing about the frictionless create/join/respond paths — no new gate.

**Non-Goals:**
- Migrating crews, plans, availability, around, or reconnect on merge (all verify-first; an anon device won't hold them).
- Requiring a phone to create or join anything.
- A persistent "unsaved" nav badge or any new dashboard structure.
- New verification transport, schema, or a second verify UI.

## Decisions

**1. Migrate footprint inside `finalizeVerification`'s merge branch, not as a separate call.**
The merge branch already knows both ids: `participantId` (the ghost/device) and `canonical.id`. Add one repo call `reassignPulseFootprint(fromGhostId, toCanonicalId)` invoked only when `canonical` exists and `canonical.id !== participantId`. Keeping it inside `finalizeVerification` means both the real SMS path and the guest-code bypass get it for free (they already share this function), so behavior can't diverge. The in-place-upgrade branch (`merged:false`) needs no migration — the row is literally the same participant.

_Alternative considered:_ reassign only the one pulse threaded through the save UI. Rejected — the guest-join case reassigns a response, not a created pulse, and threading an id per surface is more code than a general two-column sweep. The general sweep is also correct for any future anon footprint.

**2. Reassignment is two `UPDATE`s with explicit response-conflict resolution.**
`pulses.created_by` has no uniqueness on the participant, so `UPDATE pulse.pulses SET created_by = canonical WHERE created_by = ghost` is unconditional. `pulse_responses` is PK `(pulse_id, participant_id)`, so a blind update collides when the canonical already responded to the same pulse. Resolve by deleting the ghost's response on pulses where the canonical already has one, then reassigning the rest:
```
DELETE FROM pulse.pulse_responses g
 WHERE g.participant_id = ghost
   AND EXISTS (SELECT 1 FROM pulse.pulse_responses c
                WHERE c.pulse_id = g.pulse_id AND c.participant_id = canonical);
UPDATE pulse.pulse_responses SET participant_id = canonical WHERE participant_id = ghost;
```
Keeping the canonical's existing response (deleting the ghost's) is the safe default — the canonical identity is the durable one the user is consolidating onto. Run the two statements sequentially (the local PGlite harness serializes one backend session; racing statements interleave the wire protocol — same constraint already documented in `repo.ts`).

_Alternative considered:_ `ON CONFLICT DO NOTHING` via insert/delete. Rejected — a plain `UPDATE ... participant_id` cannot express `ON CONFLICT`; the delete-then-update pair is the clearest expression and is easy to test.

**3. Save prompts are pure client state layered on the existing delivery/detail components.**
- Delivery (`CreateForm.client.tsx`): the `delivery` render branch gains a `SaveYourPulse` block above the existing copy/open actions, shown only when the viewer is unverified. It mounts `useVerifyFlow` directly (like `LoginFlow` does) rather than the `VerifySheet` modal — the delivery screen is already a full surface, so an inline step reads better than a sheet over it. On `onVerified` it flips to a "saved" acknowledgement; the copy/open actions stay throughout.
- Guest join (`Pulse.client.tsx`): after `setStatus` succeeds for a viewer where `!viewer.verified`, set a `showSave` flag (once per pulse, suppressed after dismiss/verify). Render one soft line in the YOU panel that opens a `VerifySheet`. The status write already returns the fresh `viewer`; on verify we update the store's viewer so the line self-suppresses.

Both need the viewer's `verified` bit client-side. The pulse detail already carries `PublicViewer` (has `verified`). The delivery response from `POST /api/pulse/pulses` does not currently include the viewer; add `verified` to that response (cheap — the route already resolved the participant) so the delivery screen can decide whether to show the save step without an extra round-trip.

**4. Copy lives in `authCopy` (`copy.ts`), house voice.**
New strings: save-pulse heading/subline, save-spot line, privacy reassurance mirroring Partiful ("Your number is only used for verification & event updates — never shown to anyone"), and the skip affordance. Statements not questions; no guilt; no flame motif (text only, reuse existing button styles).

## Risks / Trade-offs

- **[Deleting the ghost's response on conflict loses its status/note/ETA if it differed from the canonical's.]** → Rare (same human, same pulse, two identities) and low-stakes (presence, not durable data); keeping the canonical response is the predictable rule. Documented in the repo helper.
- **[A merge now issues writes, not just a cookie swap — a failure mid-migration could half-move the footprint.]** → Both statements are idempotent (re-running reassigns/deletes by the same predicates); wrap them so a partial failure surfaces as a verify error the user can retry rather than a silent orphan. No cross-table transaction is required for correctness because the operations are re-runnable.
- **[Adding `verified` to the create-pulse response is a payload change.]** → Additive field, no existing consumer reads it; safe.
- **[Guest-join prompt could feel naggy on the highest-traffic surface.]** → One line, dismissible, once-per-pulse, never covering the status control; suppressed for verified viewers.

## Migration Plan

No schema migration. Ship behind no flag — all changes are additive to UI and to the merge branch. Rollback is a straight revert; already-migrated rows stay correctly attached to canonical identities (the reassignment is not reversed, nor should it be — the data is more correct after).

## Open Questions

None blocking. Copy wording is the one soft area and is cheap to iterate post-implementation.

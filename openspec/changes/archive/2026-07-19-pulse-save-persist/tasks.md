## 1. Persistence fix — merge migrates footprint

- [x] 1.1 Add `reassignPulseFootprint(fromGhostId, toCanonicalId)` to `apps/web/lib/pulse/repo.ts`: delete the ghost's `pulse_responses` on pulses where the canonical already responded, then `UPDATE pulse.pulse_responses SET participant_id = canonical WHERE participant_id = ghost`, then `UPDATE pulse.pulses SET created_by = canonical WHERE created_by = ghost` — statements run sequentially (PGlite single-session constraint).
- [x] 1.2 Call `reassignPulseFootprint` from `finalizeVerification` in `apps/web/lib/pulse/phone.ts`, in the ghost-merge branch only (canonical exists and `canonical.id !== participantId`); guard so a failure surfaces as a verify error, not a silent half-merge.
- [x] 1.3 Add repo tests (`repo.test.ts`): pulse created_by reassigned; response reassigned; response conflict (canonical already responded) resolves to a single row keeping the canonical's; in-place upgrade path unaffected.
- [x] 1.4 Add a `phone.ts`/verify test asserting `merged:true` now carries created pulses + responses onto the canonical participant.

## 2. Create-pulse response exposes viewer verified state

- [x] 2.1 In the `POST /api/pulse/pulses` route, include the acting participant's `verified` bit in the JSON response (participant already resolved; reuse `toPublicViewer`/`isVerified`).
- [x] 2.2 Confirm no existing consumer breaks on the added field (additive only).

## 3. Copy — authCopy save strings

- [x] 3.1 Add to `authCopy` in `apps/web/lib/pulse/copy.ts`: `savePulseHeading`, `savePulseBlurb`, `savePrivacyLine` (Partiful reassurance), `saveSpotLine`, `saveSkipCta`, `savedAck` — house voice (statements, no guilt, no flame motif).

## 4. Delivery screen — "Save your pulse" step

- [x] 4.1 In `apps/web/app/p/new/CreateForm.client.tsx` delivery branch, read `verified` from the create response; when unverified, render an inline `SaveYourPulse` block above the existing copy/open actions using `useVerifyFlow` (inline step, not a sheet).
- [x] 4.2 Include the name field only when the participant has no display name (post `POST /api/pulse/name` on submit, same as `LoginFlow`).
- [x] 4.3 On `onVerified`, flip to the saved acknowledgement; keep copy-link + open-pulse reachable throughout as the "just grab the link" escape.
- [x] 4.4 Verified creators see no save step (delivery actions only).

## 5. Guest join — "Save your spot" line

- [x] 5.1 In `apps/web/app/p/s/[token]/Pulse.client.tsx`, after `setStatus` succeeds for an unverified viewer, set a `showSave` flag (once per pulse; suppressed after dismiss or verify).
- [x] 5.2 Render one soft, dismissible line in the YOU panel (both mobile + desktop trees) that opens a `VerifySheet`; never covers the status control.
- [x] 5.3 On verify, update the store viewer (`setViewer`) so the line self-suppresses; verified viewers never see it. Status tap stays ungated in all cases.

## 6. Dash / nav — light alignment only

- [x] 6.1 Align dash "Been here before?" copy if wording drift with new save strings warrants it (behavior unchanged); leave nav "Log in" chip as-is. No structural change. — Reviewed: `dashCopy.recoveryBlurb` ("…crews and pulses follow you to this device. Never shown to anyone.") already matches the new `savePrivacyLine`/`savedAck` voice; no drift warrants a change.

## 7. Verify end-to-end

- [x] 7.1 `npm run test` (apps/web) green; `npm run lint:web` clean. — Full suite 122 passed / 74 DB-gated skipped; lint clean (only 2 pre-existing `asker` warnings); `tsc --noEmit` clean. DB-gated tests run against local PGlite: repo 19/19 (incl. 3 new footprint tests), phone 26/26 (incl. new merge-carries-footprint test).
- [x] 7.2 Manual E2E: drop a pulse anonymously → save step → verify a NEW number (in-place) → pulse on dash. Repeat verifying an EXISTING number (merge) → pulse still on dash. Guest-join save line appears once, dismiss suppresses, status never gated. — Run and confirmed working by the user (guest-code verify path + flows).
- [x] 7.3 Verify both breakpoints — mobile ~390px and desktop ≥1100px — on delivery screen and pulse detail (use `/p/s/preview` for the detail, no DB writes). — Run and confirmed by the user.

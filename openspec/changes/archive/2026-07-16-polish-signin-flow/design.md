# polish-signin-flow — design

## Context

`/p/login` runs on `useVerifyFlow()` (shared with `VerifySheet`), a two-state machine: `phone → code`. Each step renders exclusively, so submitting a phone erases it from the screen — no confirmation of where the code went, no resend affordance. The issue endpoint already tolerates re-issue (3/phone, 8/IP per 10-minute window in `lib/pulse/phone.ts`); the UI just never calls it twice.

New users arrive nameless: `createParticipant` sets no display name, and the only name-collection paths are the inline "needName" prompts on pulse/board responses. `setDisplayName` is reachable only inside the presence and pulse-response routes — there is no standalone name endpoint.

`lib/pulse/phone.ts` imports `node:crypto` and the SMS sender, so client components cannot import its `normalizePhone` for display formatting.

Reference UX (Partiful): the phone section persists through the code step ("We sent +1 646-226-8158 a code via SMS"), the code field has a visible "Verification Code" label, resend has a countdown, and new accounts get a name step after verify.

## Goals / Non-Goals

**Goals:**
- Code step keeps the number visible: disabled phone field + "We sent {number} a code via SMS" line.
- Labeled code field, resend with countdown, consent line under the send CTA.
- New users (no display name) get an inline name step after verify, before `/p`.
- A minimal name-setting endpoint backing that step.

**Non-Goals:**
- Terms/Privacy pages or a consent checkbox (passive line only).
- Country-code picker (static +1 stays).
- Name editing on `/p/account`.
- Changing the sheet's name behavior — its callers (boards/pulses) already collect names contextually.
- Any change to verify API semantics, rate limits, or code lifetimes.

## Decisions

**1. Resend lives in `useVerifyFlow`, countdown is client-side.**
The hook gains `resendIn` (seconds, ticks down from 30 after every send) and `resend()` (re-calls the issue endpoint, restarts the countdown, stays on the code step). Both verify surfaces get it for free. The 30s is purely UX pacing; the real guard is the server's existing 3-per-10-min phone limit — a throttled resend surfaces the mapped error. Alternative considered: countdown in `LoginFlow` only — rejected, the sheet has the same dead-end today.

**2. Phone field persists, disabled, during the code step (login page).**
Closest to the Partiful reference and to the user's report ("persists and doesn't replace the number section"). The +1 prefix and filled input stay rendered with `disabled`, the sent-to line and code section render beneath. "Use a different number" (existing `restart`) re-enables it. The sheet — a compact overlay — gets only the sent-to line, not the persistent field.

**3. Display formatting via a client-safe phone module.**
Extract the pure helpers (`normalizePhone`, `maskPhone`) from `lib/pulse/phone.ts` into `lib/pulse/phone-format.ts` (no node imports) and add `formatPhoneDisplay(input)` → `+1 646-226-8158` (falls back to the raw input when unparseable). `phone.ts` re-exports them so every existing server import and test keeps working. Alternative: duplicating normalization client-side — rejected, drift between the displayed and dialed number is exactly the bug class to avoid. The full number shown is the one the user just typed — nothing new serializes from the server.

**4. Name step is owned by `LoginFlow`, not the hook.**
On `onVerified`, `LoginFlow` inspects the returned viewer: `displayName` present (returning user / ghost merge) → `router.push('/p')` as today; absent → local `name` step with "What's your name?", required non-empty, capped at `CAPS.displayName`. Submit hits the name endpoint, then navigates. No skip button — the lazy needName prompts remain the fallback for anyone who bails. The sheet's `onVerified` contract is untouched.

**5. Name endpoint: `POST /api/pulse/name`.**
Resolves the participant from the identity cookie (`getViewer`), 401 without one, trims/caps via the existing `setDisplayName`, 422 on empty, returns `toPublicViewer`. Not gated on `requireVerified` — presence/pulse-response already let unverified participants name themselves; tier-gating names would be a new (and pointless) restriction. Alternative: `PATCH /api/pulse/account` — rejected as speculative surface; rename later if an account editor materializes.

**6. Consent line renders on both send surfaces.**
One `authCopy.consentLine` string under "Text me a code" on the login page and in the sheet — consent belongs wherever we trigger an SMS, and it's one line of copy.

## Risks / Trade-offs

- [Helper extraction breaks a stale import] → `phone.ts` re-exports the moved helpers; `npm run test` (identity/phone suites) is the gate.
- [Resend hits the server throttle after 2 retries] → expected; the mapped `throttled` error shows and the countdown still restarts. No client-side lockout needed at these volumes.
- [User closes the tab on the name step] → they're verified but nameless — the pre-existing state; lazy needName prompts still catch them. No new failure mode.
- [Countdown timer vs. React strict-mode double-mount] → interval owned by a `useEffect` keyed on the last-send timestamp; cleanup on unmount.

## Open Questions

(none — scoping decisions were made with the user: inline name step, passive consent line)

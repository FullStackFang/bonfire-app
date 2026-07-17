# polish-signin-flow

## Why

First real-user test of `/p/login` surfaced two gaps against the Partiful reference flow: the code step silently replaces the phone form (no confirmation of which number was texted, no resend), and a brand-new user is never asked for a name — they land on `/p` anonymous and `/p/account` shows "—". The flow also sends SMS with no consent language, which we'll need before real Twilio/10DLC traffic.

## What Changes

- **Code step persists the phone context.** Instead of swapping the phone form for a bare code field, the code step keeps the verified-number context visible: "We sent +1 646-226-8158 a code via SMS", a labeled "Verification Code" field, and a "Didn't receive your code? Resend it in Ns" countdown that re-issues through the existing endpoint (rate limits unchanged).
- **Inline name step for new users.** After a successful code confirm, if the signed-in viewer has no display name, the login page shows a "What's your name?" step before navigating to `/p`. Returning users (ghost-merged or already named) skip it. Requires a small name-setting endpoint for verified viewers (today `setDisplayName` is only reachable through presence/pulse-response writes).
- **Passive SMS-consent line.** One quiet line under the "Text me a code" button: consent to a one-time verification text, msg & data rates may apply. No checkbox, no Terms/Privacy links (those pages don't exist yet).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `phone-signin`: the "Dedicated sign-in page" requirement gains phone-context persistence, resend, and consent copy on the code step; a new requirement covers the post-verify name step for nameless viewers and the endpoint that backs it.

## Impact

- `apps/web/app/p/login/login.client.tsx` — code-step markup (sent-to line, labeled field, resend countdown, consent line), new name step.
- `apps/web/app/p/verify.client.tsx` — `useVerifyFlow` grows resend + post-verify name handling shared with the sheet; sheet code step gets the same sent-to line.
- `apps/web/lib/pulse/copy.ts` — new `authCopy` strings (sent-to template, resend, name step, consent line).
- `apps/web/lib/pulse/phone.ts` — display formatting for the entered number (e.g. `+1 646-226-8158`); full number stays client-side only (it's what the user just typed — nothing new serializes from the server).
- New route `apps/web/app/api/pulse/name` (or equivalent) — sets the viewer's display name; reuses `setDisplayName` + `CAPS.displayName`.
- Verify API (`/api/pulse/verify` POST) semantics unchanged — resend is just another issue call under existing rate limits.

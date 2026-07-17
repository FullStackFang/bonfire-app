# polish-signin-flow — tasks

## 1. Client-safe phone formatting

- [x] 1.1 Create `apps/web/lib/pulse/phone-format.ts` with the pure helpers moved from `phone.ts` (`normalizePhone`, `maskPhone`) plus new `formatPhoneDisplay(input)` → `+1 646-226-8158` (raw input fallback when unparseable); no node imports
- [x] 1.2 Re-export the moved helpers from `phone.ts` so existing server imports and tests are untouched; add `formatPhoneDisplay` unit tests beside the existing phone tests and run `npx vitest run` on them

## 2. Name endpoint

- [x] 2.1 Add `apps/web/app/api/pulse/name/route.ts` — POST resolves participant from the identity cookie (401 without), trims/caps via `setDisplayName`, 422 on empty-after-trim, returns `toPublicViewer`; no `requireVerified` gate
- [x] 2.2 Unit-test the route's reject paths (no cookie, empty name) and the happy path

## 3. Verify flow hook (shared)

- [x] 3.1 Extend `useVerifyFlow` in `verify.client.tsx` with `resendIn` (30s countdown keyed on last-send timestamp, interval cleaned up on unmount) and `resend()` (re-issue to same phone, restart countdown, stay on code step; throttled error surfaces via existing `err` mapping)
- [x] 3.2 Add the sent-to confirmation line (via `formatPhoneDisplay`) and resend affordance to the `VerifySheet` code step; consent line under its send button

## 4. Login page

- [x] 4.1 New `authCopy` strings in `copy.ts`: sent-to template, code field label, resend countdown/active copy, consent line, name-step heading/placeholder/CTA
- [x] 4.2 Code step persists the phone section in `login.client.tsx`: +1 prefix and phone input stay rendered `disabled`, sent-to line beneath, visibly labeled code field, resend countdown → active resend, "Use a different number" re-enables the phone field
- [x] 4.3 Consent line under "Text me a code" on the phone step
- [x] 4.4 Name step: on verified callback, viewer without `displayName` → inline "What's your name?" (required non-empty, `CAPS.displayName` max) posting to `/api/pulse/name` then `router.push('/p')`; viewer with a name navigates immediately

## 5. Verify end-to-end

- [x] 5.1 `npm run test` green in `apps/web`; `npm run lint:web` clean
- [x] 5.2 Manual pass against the dev server: new number → code step keeps number visible + sent-to line → resend counts down and re-issues → confirm → name step → lands on `/p` named; repeat with an existing number → no name step (ghost merge path); `/p/account` shows the chosen name

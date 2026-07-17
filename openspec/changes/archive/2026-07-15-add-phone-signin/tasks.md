# Tasks: Add Phone Sign-In

## 1. Shared verify flow + identity helpers

- [x] 1.1 Extract the issue/confirm fetch, step, and error state from `VerifySheet` into a `useVerifyFlow()` client hook (in `apps/web/app/p/verify.client.tsx` or a sibling); rewire `VerifySheet` onto it with zero behavior change — existing `phone.test.ts` / `identity.test.ts` stay green
- [x] 1.2 Add `clearParticipant()` to `apps/web/lib/pulse/identity.ts` (delete the `pulse_pid` cookie beside `adoptParticipant`); unit-test it
- [x] 1.3 Add sign-in/account/nav copy strings to `apps/web/lib/pulse/copy.ts` ("Sign in or sign up", masked-phone label, sign-out CTA, nav labels "Log in"/"Account")

## 2. Sign-out endpoint

- [x] 2.1 Add `POST /api/pulse/signout` route handler calling `clearParticipant()`; returns ok, leaves the participant row untouched
- [x] 2.2 Test: signed-in request → cookie cleared in response; subsequent `getViewer()` resolves null

## 3. Login page

- [x] 3.1 Create `apps/web/app/p/login/page.tsx` (server): `getViewer()`; verified viewer → `redirect('/p')`; otherwise render the client flow
- [x] 3.2 Create the login client component on `useVerifyFlow()`: brand mark, "Sign in or sign up" heading, static 🇺🇸🇨🇦 +1 prefix chip + phone field (`autoComplete="tel"`), code step (`autoComplete="one-time-code"`), error and throttle states matching `VerifySheet` copy
- [x] 3.3 On confirm success: `router.push('/p')` + `router.refresh()` so the dash renders the (possibly ghost-merged) identity
- [x] 3.4 Point the dash `RecoveryEntry` CTA at `/p/login` (Link) instead of mounting its own sheet, or confirm with the spec that keeping the sheet is preferred — one flow, no drift

## 4. Account page

- [x] 4.1 Create `apps/web/app/p/account/page.tsx` (server): unverified → `redirect('/p/login')`; verified → display name, phone masked to last 4 (mask server-side; full number never serialized), sign-out button
- [x] 4.2 Sign-out client action: `POST /api/pulse/signout` then hard-navigate to `/p` (full reload so all server components re-read the empty cookie)

## 5. Navbar auth chip

- [x] 5.1 Add a person-icon auth chip to `PulseTabBar` after Groups: unverified → "Log in" / `/p/login`; verified → "Account" / `/p/account`; active-route logic and aria-label per the app-navigation delta
- [x] 5.2 Pass `verified` from `layout.tsx`'s existing `getViewer()` read into the bar (both the Suspense fallback and `LiveTabBar`); verify the fallback renders a sane signed-out default without blocking first paint
- [x] 5.3 Check the four-chip bar on phone width (fixed bottom bar) and desktop rail — spacing, safe-area, chunky-chip press states

## 6. Verification

- [x] 6.1 `npm run test` in `apps/web` green; `npm run lint:web` and `npm run build:web` clean
- [x] 6.2 E2E smoke on local DB (PGlite, per pulse_local_db memory): fresh device → `/p/login` → phone → code (mock SMS) → lands on `/p` signed in; nav chip flips to Account
- [x] 6.3 E2E ghost merge: verify a phone on device A, sign in with the same phone from a fresh browser profile → dash shows device A's crews/pulses
- [x] 6.4 E2E sign-out: Account → sign out → `/p` renders signed-out, nav shows "Log in"; sign back in recovers the identity
- [x] 6.5 Confirm `/p/login` redirect for verified viewers and `/p/account` redirect for unverified visitors

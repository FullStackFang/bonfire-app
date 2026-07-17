# Add Phone Sign-In

## Why

The app has a complete SMS-OTP verification backend (`/api/pulse/verify`, ghost merge, tier gating) but no visible sign-in mechanism: identity is cookie-born and verification only surfaces mid-act or via a small recovery link on an empty dashboard. A visitor cannot answer "am I signed in?" or "how do I sign in on this device?" — there is no front door. Partiful proves the model: browsing stays ungated, but an explicit login page (logo, "Sign in or sign up", country code + phone number → OTP) plus visible signed-in state makes identity legible.

## What Changes

- New dedicated sign-in page at `/p/login`, Partiful-structured: brand mark, "Sign in or sign up" heading, country-code selector (US/CA) + phone number field, then a 6-digit code step. Reuses the existing `/api/pulse/verify` issue/confirm endpoints unchanged.
- Signing in on a device that already has a canonical phone identity performs the existing ghost merge (device cookie re-points); a first-time phone becomes a verified participant — "sign in" and "sign up" are the same flow, hence the heading.
- Visible auth state in the `/p` shell: a signed-out entry point (LOGIN) that routes to `/p/login`, and a signed-in profile affordance replacing it once verified.
- Sign out: an action that clears the device identity cookie, returning the device to a fresh tier-0 state.
- The lazy in-context `VerifySheet` (durable-act interception) and dashboard recovery entry remain unchanged — the login page is an additional front door, not a gate. Consumption paths stay phone-free.

## Capabilities

### New Capabilities

- `phone-signin`: The explicit sign-in surface — the `/p/login` page structure and flow (phone → OTP → signed in, sign-in and sign-up unified), visible signed-in/signed-out state in the app shell, and sign-out.

### Modified Capabilities

- `app-navigation`: The web pulse navigation requirement currently fixes the shell to three tabs (Home, Events, Groups); it gains an auth affordance — a LOGIN entry when the viewer is unverified and a profile affordance when verified.

## Impact

- `apps/web/app/p/` — new `login/` route; nav/shell (`nav.client.tsx` or `layout.tsx`) gains the auth affordance; `dash.client.tsx` recovery entry may link to `/p/login`.
- `apps/web/app/api/pulse/` — new sign-out route handler (cookie clear); existing `verify` endpoints reused as-is.
- `apps/web/lib/pulse/identity.ts` — add a `clearParticipant`/sign-out helper alongside `adoptParticipant`.
- No schema/migration changes; no changes to `phone-identity` spec requirements (verification semantics, rate limits, ghost merge all reused).
- `apps/mobile` untouched.

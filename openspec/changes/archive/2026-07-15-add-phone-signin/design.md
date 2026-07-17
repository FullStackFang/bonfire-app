# Design: Add Phone Sign-In

## Context

Identity in `apps/web` is two-tier (see `openspec/specs/phone-identity/spec.md`): an httpOnly cookie participant (tier 0) and a phone-verified tier reached through `/api/pulse/verify` (POST issues a hashed, rate-limited 6-digit SMS code; PUT confirms and ghost-merges the device cookie onto a canonical participant when the phone already exists). The UI surfaces this only lazily: `VerifySheet` (a modal) mounted by durable acts, and `RecoveryEntry` on the dashboard. There is no route a person can visit to sign in, no visible signed-in/out state, and no sign-out. The `/p` shell renders a three-tab icon navbar (`nav.client.tsx`) mounted once in `app/p/layout.tsx` — bottom chips on phones, left rail on desktop.

The target structure is Partiful's login screen: brand mark, "Sign in or sign up" heading, 🇺🇸🇨🇦 country prefix + phone field, then a code step — one flow for both new and returning people.

## Goals / Non-Goals

**Goals:**
- A dedicated `/p/login` page with the Partiful structure, reusing `/api/pulse/verify` unchanged.
- Visible auth state in the `/p` shell: a way in when signed out, a profile affordance when signed in.
- Sign-out (clear the device cookie → fresh tier-0 device).
- One flow for sign-in and sign-up — the backend already unifies them (first verify sets the phone; existing phone ghost-merges).

**Non-Goals:**
- No auth wall — consumption paths stay cookie-only per the phone-identity spec.
- No international dial-code selector (US/CA only, both +1 — matching `normalizePhone`'s bare-10-digit assumption and Partiful's own default).
- No changes to verification semantics, rate limits, code TTL, or ghost-merge behavior.
- No password, email, or third-party auth. No "get the app" nudge (mobile app isn't launched).
- `apps/mobile` untouched.

## Decisions

**1. `/p/login` is a page inside the pulse shell, not a sheet.**
It lives under `app/p/login/` so it inherits `pulse.css` and the warm-room framing. A server component reads `getViewer()`; an already-verified viewer is redirected to `/p` (a login page for a signed-in person is dead UI). The client flow is the same two steps as `VerifySheet` (phone → code) rendered full-page: brand mark, "Sign in or sign up" heading, static 🇺🇸🇨🇦 +1 prefix chip beside the phone field, `autoComplete="tel"` / `one-time-code"` preserved. Alternative considered: routing the nav's LOGIN to open the existing sheet — rejected because a sheet needs a host page and can't be linked, and the user explicitly asked for the Partiful page structure.

**2. Share the verify state machine as a client hook, not duplicated fetch code.**
Extract the issue/confirm fetch + error/step state from `VerifySheet` into a `useVerifyFlow()` hook (same file or sibling), consumed by both `VerifySheet` (unchanged behavior) and the login page. The two surfaces share endpoints, error mapping, and step transitions; only markup differs. Alternative: copy the ~60 lines into the page — rejected, two drifting copies of error-code handling.

**3. Auth affordance is a fourth nav chip.**
`PulseTabBar` gains a person icon chip after Groups: signed out it labels "Log in" and links to `/p/login`; signed in it labels "Account" and links to `/p/account`. The chip follows the existing chunky-chip states and active-route logic. The viewer's verified state is read in `layout.tsx` (already resolves `getViewer()` for the spark dot — no extra query) and passed to the bar. Alternative considered: a LOGIN button in the dash header (Partiful's top-right) — rejected because it exists only on the dash; the nav is the one persistent shell element across `/p` surfaces.

**4. Minimal `/p/account` page hosts signed-in state and sign-out.**
Server-rendered: display name, masked phone (last 4 only — full numbers never serialize, per phone-identity), and a sign-out button. Unverified visitors are redirected to `/p/login` (mirror of the login redirect). This is deliberately thin — its job is to make "you are signed in as X" legible and give sign-out a home, not to be a profile editor.

**5. Sign-out is a route handler that deletes the cookie.**
`POST /api/pulse/signout` calls a new `clearParticipant()` helper in `identity.ts` (cookie delete beside `adoptParticipant`). The participant row is untouched — the phone identity survives and can be recovered by signing in again on any device (that's the whole point of tier 1). The client posts, then hard-navigates to `/p` so every server component re-reads the now-empty cookie. Alternative: a Server Action — a route handler matches the codebase's existing write-path idiom (`app/api/pulse/*`).

**6. Login success routes to `/p`.**
On confirm, the cookie is already set/re-pointed by the API; the page does `router.push('/p')` + `router.refresh()`. The dash then renders the canonical identity's crews and pulses (the existing ghost-merge behavior, now reachable from a front door).

## Risks / Trade-offs

- [Fresh devices visiting `/p/login` mint a tier-0 participant row on code issue (POST calls `resolveOrCreateParticipant`)] → Already the accepted pattern for every write path; ghost rows are tolerated by design and rate limits cap the mint rate.
- [Fourth chip crowds the phone bottom bar] → Icon-only chips are compact; four is well within thumb-bar norms (Partiful's own app bar holds five). The delta spec updates app-navigation so the three-tab requirement doesn't silently drift.
- [Sign-out on a shared/borrowed device leaves the participant row intact] → Intended: cookie deletion is device-scoped sign-out, not account deletion. The next person on the device starts tier-0.
- [Two entry points to the same flow (login page + lazy VerifySheet) could drift in copy/behavior] → Mitigated by the shared `useVerifyFlow` hook; copy stays centralized in `lib/pulse/copy.ts`.

## Open Questions

- None blocking. (If Canadian bare 10-digit numbers matter later, `normalizePhone` already accepts them as +1 — the 🇨🇦 flag is honest.)

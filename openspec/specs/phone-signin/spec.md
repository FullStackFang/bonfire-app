# phone-signin

## Purpose

The explicit sign-in surface: the `/p/login` page and its phone-then-code flow, visible signed-in/signed-out state in the app shell (including the `/p/account` page), and sign-out.

## Requirements

### Requirement: Dedicated sign-in page
The web app SHALL serve a sign-in page at `/p/login` presenting, in order: the brand mark, a "Sign in or sign up" heading, and a phone entry step showing a static US/Canada (+1) prefix beside a phone number field, followed by a 6-digit code entry step. The phone entry step SHALL show a passive SMS-consent line beneath the send action (one-time verification text, message and data rates may apply) with no checkbox and no required acknowledgment. On advancing to the code step the phone section SHALL persist rather than be replaced: the entered number remains visible in a disabled field, and a confirmation line states that a code was sent via SMS to the entered number formatted for display (e.g. `+1 646-226-8158`). The code step SHALL present a visibly labeled verification-code field and a resend affordance that begins as a countdown (disabled, showing seconds remaining) and becomes an active resend action when it reaches zero; resending SHALL re-issue through the existing phone verification endpoints with their existing semantics (hashed codes, expiry, attempt caps, rate limits) unchanged, and SHALL restart the countdown. The flow SHALL issue and confirm codes through the existing phone verification endpoints with their existing semantics unchanged. The phone field SHALL use `autoComplete="tel"` and the code field `autoComplete="one-time-code"`. An already-verified viewer requesting the page SHALL be redirected to `/p`.

#### Scenario: Signed-out visitor sees the Partiful structure
- **WHEN** an unverified participant opens `/p/login`
- **THEN** the page shows the brand mark, the "Sign in or sign up" heading, a +1-prefixed phone field, and a consent line under the send action, with no code field yet

#### Scenario: Verified viewer is redirected
- **WHEN** a participant with a verified phone opens `/p/login`
- **THEN** they are redirected to `/p` without the sign-in form rendering

#### Scenario: Code step persists the phone section
- **WHEN** the visitor submits a valid phone and the code is issued
- **THEN** the page advances to the code step with the entered number still visible in a disabled field, a "sent via SMS" confirmation naming the display-formatted number, and a labeled 6-digit code field

#### Scenario: Resend counts down then re-issues
- **WHEN** the code step is reached and the resend countdown expires and the visitor taps resend
- **THEN** a new code is issued to the same phone through the existing endpoint and the countdown restarts

#### Scenario: Throttled resend surfaces the error
- **WHEN** a resend exceeds the existing per-phone issue rate limit
- **THEN** the throttled error is shown and no code is sent

### Requirement: Sign-in and sign-up are one flow
Confirming a code on the sign-in page SHALL sign the device in under exactly one participant: a first-time phone verifies the device's participant in place, and a phone already attached to a canonical participant re-points the device cookie to that participant (the existing ghost merge). On success the page SHALL navigate to `/p`, which SHALL render the signed-in identity's content.

#### Scenario: New phone signs up
- **WHEN** a visitor confirms a code for a phone no participant holds
- **THEN** the device's participant gains the verified phone and the visitor lands on `/p` signed in

#### Scenario: Returning phone signs in on a fresh device
- **WHEN** a visitor on a fresh device confirms a code for a phone attached to an existing canonical participant
- **THEN** the device cookie is re-pointed to that participant and `/p` shows their existing crews and pulses

### Requirement: Post-verify name step for new users
After a successful code confirmation on the sign-in page, a viewer whose participant has no display name SHALL be shown an inline name step ("What's your name?") before navigating to `/p`; submitting a non-empty name SHALL persist it (trimmed, capped at the display-name limit) and then navigate to `/p`. A viewer whose participant already has a display name (including one recovered by ghost merge) SHALL skip the name step and navigate directly to `/p`. The name SHALL be persisted through an endpoint that resolves the participant solely from the device's identity cookie, rejects requests without one, and rejects empty names; the endpoint SHALL NOT require phone verification.

#### Scenario: New user is asked for their name
- **WHEN** a visitor confirms a code and the signed-in participant has no display name
- **THEN** the page shows the name step instead of navigating, and submitting a name saves it and lands on `/p`

#### Scenario: Returning user skips the name step
- **WHEN** a visitor confirms a code and the participant (e.g. recovered by ghost merge) already has a display name
- **THEN** the page navigates to `/p` with no name step

#### Scenario: Name endpoint rejects anonymous or empty input
- **WHEN** the name endpoint is called without an identity cookie, or with a name that is empty after trimming
- **THEN** it rejects the request without changing any participant

### Requirement: Account surface for the signed-in viewer
The web app SHALL serve an account page at `/p/account` for verified viewers showing their display name, their own phone masked to at most its last four digits, and a sign-out action. No full phone number SHALL ever be serialized to the client. An unverified visitor requesting the page SHALL be redirected to `/p/login`.

#### Scenario: Signed-in viewer sees their account
- **WHEN** a verified participant opens `/p/account`
- **THEN** the page shows their display name, a masked phone ending in their last four digits, and a sign-out control

#### Scenario: Signed-out visitor is redirected to login
- **WHEN** an unverified participant opens `/p/account`
- **THEN** they are redirected to `/p/login`

### Requirement: Sign-out clears the device, not the account
A sign-out action SHALL delete the device's identity cookie and return the device to a fresh tier-0 state, leaving the participant row and its phone, availability, and crew memberships intact. After signing out the device SHALL land on `/p` rendered as a new visitor, and signing in again with the same phone SHALL recover the same participant.

#### Scenario: Sign out resets the device
- **WHEN** a signed-in viewer signs out from the account page
- **THEN** the identity cookie is cleared and `/p` renders the signed-out state

#### Scenario: Identity survives sign-out
- **WHEN** a participant signs out and later signs in with the same phone on any device
- **THEN** the same canonical participant, with unchanged crews and availability, is recovered

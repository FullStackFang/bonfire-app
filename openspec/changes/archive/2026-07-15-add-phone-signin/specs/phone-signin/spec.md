# phone-signin

## ADDED Requirements

### Requirement: Dedicated sign-in page
The web app SHALL serve a sign-in page at `/p/login` presenting, in order: the brand mark, a "Sign in or sign up" heading, and a phone entry step showing a static US/Canada (+1) prefix beside a phone number field, followed by a 6-digit code entry step. The flow SHALL issue and confirm codes through the existing phone verification endpoints with their existing semantics (hashed codes, expiry, attempt caps, rate limits) unchanged. The phone field SHALL use `autoComplete="tel"` and the code field `autoComplete="one-time-code"`. An already-verified viewer requesting the page SHALL be redirected to `/p`.

#### Scenario: Signed-out visitor sees the Partiful structure
- **WHEN** an unverified participant opens `/p/login`
- **THEN** the page shows the brand mark, the "Sign in or sign up" heading, and a +1-prefixed phone field, with no code field yet

#### Scenario: Verified viewer is redirected
- **WHEN** a participant with a verified phone opens `/p/login`
- **THEN** they are redirected to `/p` without the sign-in form rendering

#### Scenario: Code step follows phone submission
- **WHEN** the visitor submits a valid phone and the code is issued
- **THEN** the page advances to a 6-digit code entry step for that phone

### Requirement: Sign-in and sign-up are one flow
Confirming a code on the sign-in page SHALL sign the device in under exactly one participant: a first-time phone verifies the device's participant in place, and a phone already attached to a canonical participant re-points the device cookie to that participant (the existing ghost merge). On success the page SHALL navigate to `/p`, which SHALL render the signed-in identity's content.

#### Scenario: New phone signs up
- **WHEN** a visitor confirms a code for a phone no participant holds
- **THEN** the device's participant gains the verified phone and the visitor lands on `/p` signed in

#### Scenario: Returning phone signs in on a fresh device
- **WHEN** a visitor on a fresh device confirms a code for a phone attached to an existing canonical participant
- **THEN** the device cookie is re-pointed to that participant and `/p` shows their existing crews and pulses

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

# admin-access

## Purpose

Gate the `/admin/*` area of `apps/web` on the app's existing phone-OTP identity plus an environment-configured allowlist. A viewer is an admin iff phone-verified AND their server-side E.164 phone is in `ADMIN_PHONES`. Gating is done per server component (the repo's idiom — no middleware), mirroring `app/p/account/page.tsx`. The area fails closed and never discloses its existence to non-admins.

## Requirements

### Requirement: Admin identity via verified phone allowlist

The system SHALL treat a viewer as an admin if and only if the viewer is phone-verified and the viewer's server-side E.164 phone is present in the `ADMIN_PHONES` allowlist (comma-separated E.164, read from the environment). The phone number SHALL NOT be exposed to the client. When `ADMIN_PHONES` is unset or empty, no viewer SHALL be an admin.

#### Scenario: Verified admin phone is admitted

- **WHEN** a phone-verified viewer whose E.164 phone is listed in `ADMIN_PHONES` requests an `/admin` route
- **THEN** the system treats them as an admin and renders the requested admin page

#### Scenario: Verified non-admin is not admitted

- **WHEN** a phone-verified viewer whose phone is NOT in `ADMIN_PHONES` requests an `/admin` route
- **THEN** the system responds with 404 (not found) and does not render admin content

#### Scenario: Empty allowlist admits no one

- **WHEN** `ADMIN_PHONES` is unset or empty
- **THEN** every `/admin` request results in 404 for verified viewers and a redirect to sign-in for others

### Requirement: Admin area gating and non-disclosure

The system SHALL gate every `/admin/*` route. A signed-out or unverified viewer SHALL be redirected to `/p/login`. A verified non-admin SHALL receive a 404 that does not disclose the area exists. Every admin page SHALL be excluded from search indexing.

#### Scenario: Signed-out visitor is sent to sign-in

- **WHEN** a viewer with no verified identity requests any `/admin` route
- **THEN** the system redirects them to `/p/login`

#### Scenario: Admin pages are not indexed

- **WHEN** any `/admin` page is served
- **THEN** its response marks the page `noindex` (robots index disabled)

#### Scenario: Admin gating is not bypassable by a public asset

- **WHEN** admin review content is requested
- **THEN** it is served only through a gated route and never from a publicly served static path

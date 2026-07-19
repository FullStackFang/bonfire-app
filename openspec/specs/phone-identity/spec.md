# phone-identity

## Purpose

Two-tier identity on `pulse.participants`: a frictionless cookie tier for consumption and a verified-phone tier for durable acts. Consumption stays phone-free; a one-time SMS code verifies a phone and can recover a canonical participant onto a new device (ghost merge).

## Requirements

### Requirement: Consumption never requires a phone
Opening any pulse-rail link, setting board presence, and responding to a pulse SHALL work with cookie-only (tier 0) identity, exactly as before this change. The system SHALL never hard-block a tier-0 participant with "already joined" or an auth wall on these paths.

#### Scenario: Cookie-only participant taps into a pulse
- **WHEN** a participant with no verified phone opens a pulse link and taps a status
- **THEN** the response is recorded under their cookie identity with no verification prompt

### Requirement: Durable acts require a verified phone
Declaring availability (baseline or exception), creating or joining a crew, and sending an SMS-delivered pulse SHALL require `phone_verified_at` to be set on the acting participant. The API SHALL reject these acts for tier-0 participants with a response that directs the client into the verification flow, and no other act family SHALL be gated.

#### Scenario: Tier-0 participant tries to declare availability
- **WHEN** a participant with no verified phone submits an availability baseline
- **THEN** the API rejects the write and signals that phone verification is required, and no baseline row is created

#### Scenario: Verified participant declares availability
- **WHEN** a participant with a verified phone submits an availability baseline
- **THEN** the baseline row is created

### Requirement: One-time SMS code verification
The system SHALL verify a phone by sending a 6-digit code via the shared SMS transport and accepting it back within its validity window. Codes SHALL be stored hashed, SHALL expire after at most 10 minutes, SHALL allow at most 5 attempts, and SHALL be single-use. Issuing codes SHALL be rate-limited per phone and per IP.

#### Scenario: Successful verification
- **WHEN** a participant requests a code for their phone and submits the correct code before expiry
- **THEN** the participant's `phone` and `phone_verified_at` are set and the verification row is consumed

#### Scenario: Expired or exhausted code
- **WHEN** a participant submits a code after its expiry, or after 5 failed attempts on that verification
- **THEN** the verification is rejected and the participant must request a new code

#### Scenario: Code issuing is rate-limited
- **WHEN** repeated code requests for the same phone or from the same IP exceed the window limit
- **THEN** further requests are rejected with a throttle response and no SMS is sent

### Requirement: Ghost merge on verifying an existing phone
When a cookie participant verifies a phone that already belongs to another participant row, the system SHALL re-point the device cookie to the existing (canonical) participant rather than creating a duplicate phone identity. The ghost row's pulse footprint — pulses it created (`pulses.created_by`) and pulse responses it holds (`pulse_responses.participant_id`) — SHALL be reassigned to the canonical participant so work done anonymously on the device survives the merge. Where the canonical participant already has a response for the same pulse, the reassignment SHALL resolve to a single response per (pulse, participant) rather than violating the `(pulse_id, participant_id)` key. Other ghost-row activity (availability, crew membership, plans) is not migrated. The canonical row's availability and crew memberships SHALL be what the device sees afterward.

#### Scenario: New browser, existing phone
- **WHEN** a participant on a fresh cookie verifies a phone number already attached to a canonical participant
- **THEN** the response re-points the device cookie to the canonical participant, and the device subsequently sees the canonical row's baseline and crews

#### Scenario: Anonymous pulse survives the merge
- **WHEN** a participant creates a pulse under a fresh cookie identity and then verifies a phone that already belongs to a canonical participant
- **THEN** the cookie re-points to the canonical participant AND the just-created pulse is reassigned to the canonical participant, so it appears on that identity's dashboard

#### Scenario: Anonymous spot survives the merge
- **WHEN** a participant responds to a pulse under a fresh cookie identity and then verifies a phone that already belongs to a canonical participant
- **THEN** the response is reassigned to the canonical participant, and if the canonical participant already responded to that pulse the merge resolves to a single response without error

### Requirement: Identity stays server-held
The viewer's identity (participant id, phone, verification state) SHALL be exposed only through server-rendered props or state payloads, never a JS-readable cookie. Phone numbers SHALL never appear in serialized payloads sent to other participants.

#### Scenario: Another member's phone is never serialized
- **WHEN** any crew or pulse state payload is serialized for a viewer
- **THEN** it contains no phone number of any other participant

### Requirement: Verification is reachable from the dashboard
The dashboard SHALL offer a phone-verify entry point ("been here before" recovery) whenever the viewer is unverified or the dashboard is empty, reusing the existing one-time SMS code flow. It SHALL be an offer, never a gate — the dashboard renders without it.

#### Scenario: New device recovers an identity from the dash
- **WHEN** a participant on a fresh device opens `/p` and verifies the phone already attached to their canonical participant
- **THEN** the device cookie is re-pointed to that participant (ghost merge) and the dashboard immediately re-renders showing their existing crews and pulses

#### Scenario: Verified viewer sees no identity chrome
- **WHEN** a verified participant with dashboard content opens `/p`
- **THEN** no verify prompt or recovery entry is shown

# phone-identity

Two-tier identity on `pulse.participants`: a frictionless cookie tier for consumption and a verified-phone tier for durable acts.

## ADDED Requirements

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
When a cookie participant verifies a phone that already belongs to another participant row, the system SHALL re-point the device cookie to the existing (canonical) participant rather than creating a duplicate phone identity. The ghost row's tier-0 activity is not migrated. The canonical row's availability and crew memberships SHALL be what the device sees afterward.

#### Scenario: New browser, existing phone
- **WHEN** a participant on a fresh cookie verifies a phone number already attached to a canonical participant
- **THEN** the response re-points the device cookie to the canonical participant, and the device subsequently sees the canonical row's baseline and crews

### Requirement: Identity stays server-held
The viewer's identity (participant id, phone, verification state) SHALL be exposed only through server-rendered props or state payloads, never a JS-readable cookie. Phone numbers SHALL never appear in serialized payloads sent to other participants.

#### Scenario: Another member's phone is never serialized
- **WHEN** any crew or pulse state payload is serialized for a viewer
- **THEN** it contains no phone number of any other participant

# phone-identity — delta for add-pulse-dashboard

Adds the dashboard recovery entry point on top of the existing verification requirements (consumption stays phone-free; OTP mechanics, ghost merge, and server-held identity are unchanged).

## ADDED Requirements

### Requirement: Verification is reachable from the dashboard
The dashboard SHALL offer a phone-verify entry point ("been here before" recovery) whenever the viewer is unverified or the dashboard is empty, reusing the existing one-time SMS code flow. It SHALL be an offer, never a gate — the dashboard renders without it.

#### Scenario: New device recovers an identity from the dash
- **WHEN** a participant on a fresh device opens `/p` and verifies the phone already attached to their canonical participant
- **THEN** the device cookie is re-pointed to that participant (ghost merge) and the dashboard immediately re-renders showing their existing crews and pulses

#### Scenario: Verified viewer sees no identity chrome
- **WHEN** a verified participant with dashboard content opens `/p`
- **THEN** no verify prompt or recovery entry is shown

## MODIFIED Requirements

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

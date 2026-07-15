# pulse-dashboard

The participant-scoped home of the pulse rail at `/p` — everything I'm part of, one tap back into any of it.

## ADDED Requirements

### Requirement: Dashboard shows everything the viewer is part of
The system SHALL render `/p` server-side from the viewer's cookie identity, showing three sections: live pulses the viewer created or responded to ("Live now"), crews the viewer belongs to or has board presence in ("Your crews"), and recently ended pulses ("Earlier"). The page SHALL be `force-dynamic`, sent with `robots: noindex`, and SHALL never require a login for viewing.

#### Scenario: Returning participant sees their stuff
- **WHEN** a participant whose cookie has created one crew and responded "in" to one live pulse opens `/p`
- **THEN** the crew appears under "Your crews" and the pulse appears under "Live now" with their "in" response visible, each linking to `/p/c/[token]` / `/p/s/[token]`

#### Scenario: Creator sees a pulse they never responded to
- **WHEN** a participant created a pulse but has no `pulse_responses` row for it
- **THEN** the pulse still appears on their dashboard, credited as dropped by them

### Requirement: Liveness split follows the pulse lifecycle
The dashboard SHALL classify a pulse as live iff `closed_at is null` and `expires_at > now`, ordering "Live now" by soonest expiry first. Wrapped or expired pulses SHALL appear under "Earlier", most recent first, capped at a fixed limit; older items simply fall off.

#### Scenario: A wrap moves the pulse to Earlier
- **WHEN** a pulse the viewer responded to is wrapped and the viewer reloads `/p`
- **THEN** it no longer appears under "Live now" and appears under "Earlier"

#### Scenario: Earlier is quiet history, never a record
- **WHEN** ended pulses render under "Earlier"
- **THEN** they are visually muted, show no attendance judgment or "missed" framing, and no count of the viewer's non-attendance exists anywhere

### Requirement: Crews list includes presence-only participation
The system SHALL treat a crew as "mine" if the viewer has a `crew_members` row OR a `presence` row for it, excluding archived crews. Each crew entry SHALL show the crew name and the viewer's own current board status when one exists.

#### Scenario: Tier-0 tapper sees the crew without joining
- **WHEN** a participant set a board status on a crew via the shared link but never became a member
- **THEN** that crew appears under "Your crews" with their current status

### Requirement: Dashboard only exposes the viewer's own participation
Dashboard queries SHALL be keyed on the viewer's participant id and SHALL NOT reveal other participants' rosters, responses, or presence beyond what each linked page already exposes. A participant with no cookie or no participation SHALL see an empty state with a creation path — never another participant's data.

#### Scenario: Fresh device sees the empty state
- **WHEN** a device with no `pulse_pid` cookie opens `/p`
- **THEN** it sees an empty dashboard with a "Start something" path and a phone-verify recovery entry, and no participant data of any kind

### Requirement: The rail links back home
Crew, pulse, and creation pages SHALL link back to `/p` from their brand row, so the dashboard is reachable from every surface on the rail.

#### Scenario: Back home from a crew page
- **WHEN** a viewer on `/p/c/[token]` taps the brand row
- **THEN** they land on `/p`

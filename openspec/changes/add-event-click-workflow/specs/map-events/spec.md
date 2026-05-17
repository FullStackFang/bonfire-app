# map-events — Delta

## ADDED Requirements

### Requirement: Event attendance is a durable fact about the event

An event SHALL carry the set of users who have joined it. The attendance set is the single source of truth for every surface that displays "who's coming" or "X people are coming".

#### Scenario: Joining persists across screen remounts

- **WHEN** the user opens an event detail screen and taps "I'm going!"
- **THEN** the user's id is added to the event's attendance set
- **AND** the bottom CTA label becomes "You're in!"
- **AND** closing and reopening the same event still shows the "You're in!" state

#### Scenario: Joining bumps counts everywhere immediately

- **WHEN** the user joins an event from the detail screen
- **THEN** the detail screen's "N people are coming" increases by one in the same frame
- **AND** the user's avatar appears in the visible avatar stack on the detail screen
- **AND** the corresponding map pin's headcount chip updates to reflect the new count

#### Scenario: Leaving is the inverse of joining

- **WHEN** the user has joined an event and taps the CTA again
- **THEN** the user's id is removed from the attendance set
- **AND** all surfaces displaying attendees update to reflect the lower count

#### Scenario: Attendee data is read from one source

- **WHEN** the home map pin, the "bonfires near you" footer, the events list, and the event detail screen are all displayed for the same event
- **THEN** all four surfaces show counts and avatars derived from the same attendance set
- **AND** none of them invent attendee data per-render

### Requirement: Events have a lifecycle of upcoming, live, or ended

An event SHALL carry both a `starts_at` and an `expires_at` timestamp. A derived `status` of `upcoming`, `live`, or `ended` is computed from the current time, with an optional host override that can flip an upcoming event to live early.

#### Scenario: An event before its start time reads as upcoming

- **WHEN** the current time is earlier than the event's `starts_at`
- **AND** the host has not flipped the event live
- **THEN** the event's status is `upcoming`

#### Scenario: An event in its window reads as live

- **WHEN** the current time is at or after `starts_at` and before `expires_at`
- **THEN** the event's status is `live`

#### Scenario: A host can start an event early

- **WHEN** the event's status would otherwise be `upcoming`
- **AND** the host has set the live override
- **THEN** the event's status is `live`

#### Scenario: An event past its expiry reads as ended

- **WHEN** the current time is at or after `expires_at`
- **THEN** the event's status is `ended`
- **AND** the event is pruned from any surface that lists active events
- **AND** the host override cannot push an ended event back to live

### Requirement: Map pins distinguish upcoming and live events visually

The pin rendered on the home map SHALL communicate the event's status at a glance, matching the legend's "Live bonfire" and "Upcoming bonfire" entries.

#### Scenario: A live event pin shows the live treatment

- **WHEN** an event's status is `live`
- **THEN** its pin renders with the ember halo pulse and ember-coloured border
- **AND** the countdown shown is the time remaining until `expires_at`

#### Scenario: An upcoming event pin shows the upcoming treatment

- **WHEN** an event's status is `upcoming`
- **THEN** its pin renders without the ember halo
- **AND** the border uses the dashed cream-on-cream upcoming treatment
- **AND** the label shown is the time remaining until `starts_at` (e.g. "starts in 25m")

### Requirement: Map pins show a headcount affordance when others have joined

The pin SHALL surface a compact avatar stack of joined attendees when the attendance set is non-empty, matching the legend's "More people — number shows how many" entry.

#### Scenario: Pin with attendees shows an avatar stack

- **WHEN** an event has at least one attendee
- **THEN** its pin includes a compact avatar stack with up to three attendee avatars
- **AND** the stack uses the same avatar identity (letter pair + colour) used elsewhere in the app for those users

#### Scenario: Pin with many attendees shows an overflow count

- **WHEN** an event has more than three attendees
- **THEN** the stack renders a trailing "+N" badge for the remaining attendees

#### Scenario: Pin with no attendees omits the headcount affordance

- **WHEN** an event's attendance set is empty
- **THEN** its pin renders without an avatar stack and without a "+0" badge

### Requirement: The map renders a gathering radius for each event

For every event drawn on the home map, the map SHALL render a translucent circular overlay centred on the event's geo point, matching the legend's "Bonfire radius — your gathering area" entry.

#### Scenario: The radius is centred on the event's geo point

- **WHEN** the map is panned or zoomed
- **THEN** the radius overlay stays centred on the event's geo coordinate
- **AND** its on-screen diameter rescales with the map's projection so it represents a consistent real-world radius

#### Scenario: Live radius pulses; upcoming radius is flat

- **WHEN** the event's status is `live`
- **THEN** the radius overlay pulses in the ember tint on the same cadence as other live signals
- **WHEN** the event's status is `upcoming`
- **THEN** the radius overlay renders flat in the dusk tint

#### Scenario: The radius never steals pin taps

- **WHEN** the user taps an event pin that sits inside its own radius overlay
- **THEN** the tap is routed to the pin and the detail screen opens

### Requirement: A map legend surface documents the on-map vocabulary

The home map SHALL provide a discoverable surface that names the five visual entities a user encounters: Live bonfire, Upcoming bonfire, You are here, Bonfire radius, More people.

#### Scenario: Opening the legend from the map

- **WHEN** the user taps the legend control in the map header
- **THEN** a sheet appears listing the five entities, each paired with its real swatch (the actual pin/indicator/radius component) and a short description

#### Scenario: The legend stays in sync with the map

- **WHEN** the visual treatment of any pin, indicator, or radius is changed
- **THEN** the legend reflects that change without a separate update, because each legend swatch composes the real component

#### Scenario: Dismissing the legend returns the user to the map

- **WHEN** the user dismisses the legend sheet
- **THEN** the home map is restored to its prior state (same camera, same selection)

# live-pulse — Delta

## ADDED Requirements

### Requirement: A participant is an appless device identity claimed by a typed name

The system SHALL let a person act as a named participant without an account, login, or app install. The first action that needs an identity SHALL ask for a name once; thereafter the same device SHALL be recognized without re-typing. Identity is a low-stakes presence claim, not authentication.

#### Scenario: First action prompts for a name once

- **WHEN** a person with no existing device session sets a status or creates a spark
- **THEN** the system asks for a display name before recording the action
- **AND** the action is attributed to a new participant carrying that name
- **AND** a device session is established so later actions on that device need no name re-entry

#### Scenario: The same device is recognized on return

- **WHEN** a participant who has already named themselves returns to any link they can access on the same device
- **THEN** the page shows their own current status as theirs (a "this is you" affordance)
- **AND** changing status takes a single tap with no name prompt

#### Scenario: A participant can rename or re-claim without a hard error

- **WHEN** a person's device session is missing (e.g. the in-app browser dropped the cookie) and they appear as a new participant
- **THEN** the system MUST NOT block them with a "you already joined" error
- **AND** they can set a name and act immediately
- **AND** the board MAY soft-merge entries that share a display name within the same container rather than showing a hard duplicate error

#### Scenario: Identity is never read from client-side script

- **WHEN** the page needs to know who the viewer is
- **THEN** that fact is delivered by the server-rendered page or the live state payload
- **AND** the session credential itself is not readable by page scripts

### Requirement: Board presence shows who is around, self-reported and current-only

A container SHALL display each present participant's current board status drawn from a fixed set, plus an optional one-line freeform note. Status is self-reported, reflects only the current state, and never derives from device location.

#### Scenario: Setting a board status

- **WHEN** a participant taps a board status (one of the fixed set, e.g. around / busy / away / out)
- **THEN** the container shows that participant with the chosen status
- **AND** the change is a single tap

#### Scenario: Adding an optional note

- **WHEN** a participant adds a one-line note (e.g. "by the harbor, easy to grab")
- **THEN** the note shows beside their status
- **AND** the note is optional — presence is valid with no note

#### Scenario: Only the current state is shown

- **WHEN** a participant changes their status from one value to another
- **THEN** only the new status is shown
- **AND** the previous status is not retained or displayed as history

#### Scenario: Presence is never location surveillance

- **WHEN** any participant views board presence
- **THEN** every status shown is one the owner set themselves
- **AND** no status is inferred from GPS or device location
- **AND** there is no list of who is absent, silent, or has not responded

### Requirement: Anyone with a container link can create a spark from three fields

A spark SHALL be creatable by anyone holding a container link, with no approval step, from a title, a place, and a time. Creation SHALL be idempotent so a repeated submission does not create duplicates.

#### Scenario: Creating a spark inside a container

- **WHEN** a participant submits a title, place, and time on a container
- **THEN** a new live spark appears in that container for everyone with the link
- **AND** no one had to approve or invite the creator

#### Scenario: A double submission does not duplicate the spark

- **WHEN** the same create request is submitted twice (e.g. a double tap or a connection retry)
- **THEN** exactly one spark is created

#### Scenario: A standalone spark needs no container

- **WHEN** a spark is created without a container
- **THEN** it exists on its own with its own link
- **AND** it offers the same participation surface as a spark inside a container

### Requirement: Spark participation is a one-tap status with optional ETA and note

For each spark, a participant SHALL set a current participation status from a fixed set (e.g. in / on my way / here / out), optionally with an ETA and a one-line note. A standalone spark SHALL be as expressive as one inside a container.

#### Scenario: Tapping into a spark

- **WHEN** a participant taps a participation status on a spark
- **THEN** the spark shows that participant with the chosen status
- **AND** the change is a single tap

#### Scenario: On-my-way can carry an ETA

- **WHEN** a participant sets an "on my way" status and provides an ETA
- **THEN** the spark shows their ETA alongside their status

#### Scenario: A here status can carry a note

- **WHEN** a participant sets a "here" status and adds a note (e.g. "got us a table, come find me")
- **THEN** the note shows beside their status on the spark

#### Scenario: A standalone spark carries note and ETA too

- **WHEN** a participant uses a standalone spark (no container)
- **THEN** status, ETA, and note are all available exactly as on a spark inside a container

### Requirement: A container surfaces only its currently-live sparks

A container page SHALL list the sparks that are currently live, each openable, and SHALL omit sparks that have expired or been wrapped.

#### Scenario: Live sparks are listed

- **WHEN** a container has one or more live sparks
- **THEN** each is shown as an openable entry with its title, place, and time
- **AND** opening one shows that spark's participation surface

#### Scenario: Dead sparks fall off the list

- **WHEN** a spark in a container has expired or been wrapped
- **THEN** it no longer appears in the container's live list

### Requirement: A spark is live until it expires or is wrapped; the container persists

A spark SHALL be considered live only while it is unwrapped and before its expiry time. Expiry SHALL be computed against an absolute instant derived from the creator's local time so presets like "end of day" mean the creator's day. Wrapping a spark SHALL close it with a quiet summary. A container SHALL persist across its sparks' lifecycles.

#### Scenario: A spark expires at its set time

- **WHEN** a spark's expiry time has passed and it has not been wrapped
- **THEN** it is no longer live and drops out of every active list

#### Scenario: "End of day" respects the creator's timezone

- **WHEN** a spark is created with an "end of day" (or explicit clock-time) expiry
- **THEN** its expiry resolves to that wall-clock moment in the creator's own timezone
- **AND** it does not expire early for a creator whose timezone differs from the server's

#### Scenario: Wrapping a spark closes it with a summary

- **WHEN** a participant wraps a spark (e.g. "that's a wrap")
- **THEN** the spark is closed and shows a quiet summary (e.g. how many made it)
- **AND** it stops accepting new participation

#### Scenario: The container outlives its sparks

- **WHEN** every spark in a container has expired or been wrapped
- **THEN** the container still exists and can hold new sparks and presence

### Requirement: The page reflects others' changes live without a manual reload

After a participant has the page open, it SHALL reflect other participants' status, note, and spark changes within a few seconds without the viewer reloading.

#### Scenario: Another person's status appears without reload

- **WHEN** participant A has a container or spark open and participant B changes their status
- **THEN** A sees B's new status within a few seconds with no manual refresh

#### Scenario: The viewer's own tap reflects immediately

- **WHEN** a participant changes their own status
- **THEN** their change is reflected on their screen immediately, before any background refresh confirms it

#### Scenario: An idle hidden page is not continuously updated

- **WHEN** the page is in a hidden/backgrounded tab
- **THEN** it pauses live updating until it is visible again

### Requirement: Open creation is bounded against spam and oversized text

Because creation is open to anyone with a link, the system SHALL bound how much a single device can create or change in a window, and SHALL cap the length of every participant-supplied text field.

#### Scenario: Text fields are length-capped

- **WHEN** a participant submits a name, title, place, time label, or note longer than its cap
- **THEN** the value is rejected or truncated to the cap before being stored

#### Scenario: Excessive creation from one device is throttled

- **WHEN** a single device creates or mutates far faster than a real person would
- **THEN** further actions from that device are throttled within the window

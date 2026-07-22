# pulse-broadcast (delta)

## ADDED Requirements

### Requirement: Optional venue facts at creation
Pulse creation SHALL accept two optional venue facts: a `seats_cap` (positive integer) and a `count_needed_by` cutoff instant (resolved from the creator's local wall clock, before `start_at` or within the pulse window). Both SHALL be nullable and settable at creation only in v1 — no post-create edit path. When unset, the pulse SHALL look and behave exactly as a pulse without this capability. Venue facts SHALL never gate joining: no cap value blocks, queues, or waitlists a response.

#### Scenario: Facts unset means no change
- **WHEN** a pulse is created without seats cap or cutoff
- **THEN** its views render with no headcount meter, no cutoff line, and no table-called control

#### Scenario: Cap never blocks a join
- **WHEN** a pulse has a seats cap of 12 and the current headcount is already 14
- **THEN** a new viewer can still tap "in" and their response records normally

### Requirement: Party size on responses
An `in` response SHALL carry an optional `party_size` of 0–3 guests (default 0). Guests are counts, never identities: no roster row, status, or name exists for a guest. The one-tap join SHALL be preserved — tapping "in" records immediately with party 0, and party size is an optional follow-up edit on the responder's own row, changeable while the pulse accepts responses. The pulse headcount SHALL equal the sum of (1 + party_size) over responses whose status is not `out`; flipping to `out` SHALL remove the whole party from the count.

#### Scenario: One tap still joins
- **WHEN** a viewer taps "in" and never touches the party control
- **THEN** their response records with party size 0 and no additional step is required

#### Scenario: Party counts in the headcount
- **WHEN** 11 participants are in and one of them has party size 3
- **THEN** the headcount reads 14

#### Scenario: Going out removes the party
- **WHEN** a participant with party size 2 changes status to "out"
- **THEN** the headcount drops by 3

### Requirement: Headcount meter with soft overflow
When a seats cap is set, the pulse view SHALL show a headcount meter (people, guests, headcount vs. cap, and the cutoff when set). Exceeding the cap SHALL surface only as passive in-view copy (e.g. "2 over the table — someone should call the restaurant") — the system SHALL NOT send any notification, block responses, or maintain a waitlist. The word "RSVP" SHALL NOT appear in any copy.

#### Scenario: Over-cap is a soft line
- **WHEN** the headcount reaches 14 against a cap of 12
- **THEN** the meter shows the overflow visually and a passive copy line appears, and no SMS or other send occurs

### Requirement: Count snapshot at cutoff
When `count_needed_by` passes, the pulse SHALL present a locked count — the headcount computed over non-`out` responses whose `updated_at` is at or before the cutoff — derived at read time with no cron, trigger, or stored snapshot. Responses SHALL continue to be accepted after the cutoff per the existing lifecycle; late or re-dated parties SHALL render separately as "after the count." A pre-cutoff responder who edits status or party size after the cutoff SHALL be recounted into "after the count" (the snapshot reflects who was counted as of the cutoff).

#### Scenario: The number locks, the door does not
- **WHEN** the cutoff passes with a counted headcount of 14 and a new viewer then taps "in" with +1
- **THEN** the locked count still reads 14 and the newcomer's party of 2 renders as "after the count"

#### Scenario: Post-cutoff edit re-dates the party
- **WHEN** a participant counted at the cutoff increases their party size afterwards
- **THEN** their whole party moves out of the locked count and into "after the count"

### Requirement: Table-called is an egalitarian toggle
A pulse with venue facts SHALL offer a "table called" marker recording that someone contacted the venue. Anyone with the link SHALL be able to set it (mirroring wrap's authorization), setting it SHALL be idempotent, and it SHALL trigger no notification. Its state is a timestamp on the pulse, rendered as passive copy.

#### Scenario: Anyone can mark the call
- **WHEN** any participant taps "table called" twice
- **THEN** the marker is set once, all viewers see it on their next poll, and nothing is sent

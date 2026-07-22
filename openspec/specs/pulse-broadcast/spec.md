# pulse-broadcast

## Purpose

The pulse (evolved spark) plus its creator-controlled delivery step. This capability is the only notifying path in the entire system.

## Requirements

### Requirement: Pulse evolves the spark
A pulse SHALL carry the spark's shape and behavior: title/place with length caps, a machine-resolved absolute `start_at` and end instant (`expires_at`) plus the creator's IANA `timezone`, a derived `time_label` display snapshot, `client_uuid` idempotency, live iff not closed and after its start and before its end, one-tap responses (`in / on_my_way / here / out`) with optional ETA and note, wrap summary, OG unfurl, and ETag polling — all carried forward under the names (`pulses`, `pulse_responses`). `crew_id` SHALL be nullable: null is a standalone link-drop pulse; set scopes it to a crew. On creation the pulse SHALL additionally attempt to resolve its free‑text `place` to coordinates and persist `place_lat` / `place_lng` and a `place_geo_status` (`resolved` | `low_confidence` | `unresolved`); this geocoding SHALL be best‑effort and SHALL NOT block, delay, or fail pulse creation (see pulse-location-map for the asynchronous resolution contract).

#### Scenario: Standalone pulse still works appless
- **WHEN** a tier-0 participant creates a standalone pulse and another tier-0 participant opens its link and taps "in"
- **THEN** the pulse is created once (idempotent on client_uuid), the response records, and no SMS is sent

#### Scenario: Creation records a geocode status
- **WHEN** a pulse is created
- **THEN** the pulse persists a `place_geo_status`, with coordinates when the place resolved and `unresolved` (null coordinates) when it did not, and creation succeeds either way

#### Scenario: The when label is derived, never free-typed
- **WHEN** a pulse is created with a start and duration
- **THEN** its `time_label` is derived from `start_at`/`expires_at` in the creator's `timezone` (e.g. "Now · ~2h", "Tonight 8:30pm · ~2h") and there is no free-text time field on the create form

### Requirement: Creator-controlled delivery choice
Pulse composition SHALL end in a delivery step offering: (a) **Copy message + link** — the create response always includes a prewritten chat-drop message containing the pulse URL; and (b) **Text the crew** — available only when a crew is selected and the creator is a verified member of it. There SHALL be no "notify everyone" option anywhere, and no path other than (b) SHALL ever send an SMS about a pulse.

#### Scenario: Link-only delivery
- **WHEN** a creator composes a pulse and chooses only "Copy message + link"
- **THEN** they receive the prewritten message + URL and zero SMS messages are sent

#### Scenario: SMS delivery requires crew and tier
- **WHEN** a creator who is not a verified member of the selected crew attempts "Text the crew"
- **THEN** the SMS delivery is rejected while the pulse itself and its link remain usable

### Requirement: Crew SMS fan-out with delivery log
Choosing "Text the crew" SHALL send one SMS per `crew_members` row (excluding the creator) via the shared transport, writing an `sms_deliveries` row (pulse, recipient, sent_at, twilio_sid, status) per send. The unique (pulse, recipient) key SHALL guarantee a person is never texted twice for the same pulse, including across retries. The compose UI SHALL state explicitly who will be texted (e.g. "This texts the 5 people in NYC crew"). Per-participant and per-crew rate limits SHALL bound send frequency.

#### Scenario: Fan-out texts each member once
- **WHEN** a verified crew member sends a pulse with "Text the crew" to a crew of N other members
- **THEN** N `sms_deliveries` rows are written and N SMS sends are attempted, none to the creator

#### Scenario: Retry never double-texts
- **WHEN** the same pulse's SMS delivery is submitted twice (client retry)
- **THEN** recipients with an existing delivery row are skipped and receive no second message

#### Scenario: Rapid-fire sends are throttled
- **WHEN** a creator exceeds the pulse-SMS rate limit for a crew within the window
- **THEN** further SMS deliveries are rejected with a throttle response

### Requirement: Quiet hours block SMS delivery explicitly
When the send time falls within quiet hours (22:00–08:00 in the creator's declared timezone, falling back to the compose-time browser timezone), the "Text the crew" option SHALL be blocked with a visible reason. The system SHALL NOT silently queue or delay sends. The link-drop path SHALL remain available.

#### Scenario: Night-time compose
- **WHEN** a creator composes a pulse at 23:30 their time and attempts "Text the crew"
- **THEN** the SMS option is refused with a quiet-hours explanation and the copy-link path still works

### Requirement: When is a Now-or-Later start plus a duration
The create form SHALL express "when" as one control with two modes — **Now** and **Later** — plus a duration (`1h` / `2h` / `til late`), replacing the former free-text time field and the "stays live for" TTL. In **Now** mode `start_at` SHALL be the creation instant. In **Later** mode `start_at` SHALL be a creator-picked day (`Today` / `Tomorrow`) and time. In both modes `expires_at` SHALL be `start_at + duration`, where `til late` resolves to the end of the local day of `start_at`. Both instants SHALL be resolved from the creator's local wall clock (the browser's resolved IANA timezone), and that `timezone` SHALL be persisted on the pulse. The default SHALL be Now with a `2h` duration.

#### Scenario: A Now pulse starts immediately
- **WHEN** a creator drops a pulse in Now mode with a `2h` duration
- **THEN** `start_at` is the creation instant, `expires_at` is two hours later, and the pulse is live immediately

#### Scenario: A Later pulse is scheduled and shareable before it starts
- **WHEN** a creator drops a pulse in Later mode for Today at 8:30pm running `2h`
- **THEN** `start_at` is 8:30pm and `expires_at` is 10:30pm in the creator's timezone, and the pulse link is shareable and can collect responses before 8:30pm

#### Scenario: A past start is refused
- **WHEN** a creator in Later mode picks a Today time that has already passed
- **THEN** creation is refused with an inline nudge and the drop action stays disabled until `start_at` is in the future

### Requirement: A pulse's lifecycle is upcoming, live, or over
A pulse SHALL have exactly one phase for a given `now`: **upcoming** when `now < start_at`, **live** when `start_at <= now < expires_at`, and **over** when `now >= expires_at` or `closed_at` is set. A pulse SHALL auto-wrap into the over phase at `expires_at` with no cron, timer, or manual action — it simply drops out of every live list once `now >= expires_at`. Only a live or upcoming pulse SHALL accept responses; an over pulse SHALL reject them.

#### Scenario: A pulse ends itself at its end instant
- **WHEN** an unclosed pulse's `expires_at` passes with no one taking any action
- **THEN** the pulse is over: it leaves every live list and stops accepting responses, with no wrap tap required

#### Scenario: Upcoming pulse collects intent, then goes live
- **WHEN** a viewer opens an upcoming pulse and taps "in", then reloads after `start_at` passes
- **THEN** the "in" response is recorded while upcoming, and after `start_at` the same pulse renders as live

### Requirement: Manual wrap ends a pulse early and cannot be triggered by a status tap
The manual wrap SHALL exist only to end a pulse **before** its `expires_at`. Its authorization SHALL be unchanged from v1 (anyone with the link may wrap; no host role is introduced). The wrap control SHALL NOT sit within or adjacent to the personal status ("here") region, and SHALL require an explicit confirm, so that changing one's own status — including reaching "here" — can never end the pulse for everyone. Wrapping SHALL remain idempotent and SHALL still return the made-it summary.

#### Scenario: Reaching "here" never ends the event
- **WHEN** a participant drags or taps their status to "here"
- **THEN** their status updates to here and the pulse remains live — no wrap occurs

#### Scenario: Ending early takes a deliberate confirm
- **WHEN** a viewer chooses "End early" and confirms
- **THEN** the pulse closes (over), further responses are rejected, and the made-it summary returns; a single stray tap without the confirm does not close it

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

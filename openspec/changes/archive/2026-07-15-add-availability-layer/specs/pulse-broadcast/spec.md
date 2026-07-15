# pulse-broadcast

The pulse (evolved spark) plus its creator-controlled delivery step. This capability is the only notifying path in the entire system.

## ADDED Requirements

### Requirement: Pulse evolves the spark
A pulse SHALL carry the spark's shape and behavior: title/place/time_label with length caps, absolute client-resolved `expires_at`, `client_uuid` idempotency, live iff not closed and not expired, one-tap responses (`in / on_my_way / here / out`) with optional ETA and note, wrap summary, OG unfurl, and ETag polling — all carried forward unchanged under the new names (`pulses`, `pulse_responses`). `crew_id` SHALL be nullable: null is a standalone link-drop pulse; set scopes it to a crew.

#### Scenario: Standalone pulse still works appless
- **WHEN** a tier-0 participant creates a standalone pulse and another tier-0 participant opens its link and taps "in"
- **THEN** the pulse is created once (idempotent on client_uuid), the response records, and no SMS is sent

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

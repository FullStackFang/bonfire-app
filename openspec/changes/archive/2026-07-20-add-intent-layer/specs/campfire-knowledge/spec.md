# campfire-knowledge

> The doctrine governing everything Bonfire knows about a person: the line isn't what the system knows — it's where it learned it and where it shows up again. Bonfire remembers what a good friend at the table would remember, only tells the room it learned it in, and only speaks through better suggestions. This capability constrains every current and future intelligence surface (the intent resolver in this change; dietary picks, activity affinities, venue preferences, and availability rhythms in future ones). **Declared signals are distinct from observed knowledge:** an intent tap or an "again" tap is a deliberate speech act whose entire purpose is its (mutuality-gated) reveal — those follow their own visibility specs. Everything the system merely *observes* follows the rules below.

## ADDED Requirements

### Requirement: Provenance — only what was said inside the campfire
Everything the system knows about a person SHALL trace to something they did or said on Bonfire's own surfaces — a pick on a plan, a tap, a rating, a message to the crew. The system SHALL NOT enrich from outside sources (contacts, social profiles, email, calendars-as-content) and SHALL NOT infer facts that were not stated (no life-event detection, no relationship-status guessing, no pattern-derived health or personal inferences). The test: could an attentive human friend at the table know this from what happened here?

#### Scenario: In-campfire acts are the entire corpus
- **WHEN** any intelligence surface assembles what it knows about a participant
- **THEN** every input traces to an act the participant performed on a Bonfire surface, and nothing else

#### Scenario: No inference beyond the stated
- **WHEN** a participant's behavior would support an unstated inference (e.g., a pattern suggesting a life event)
- **THEN** the system stores and uses nothing beyond the stated acts themselves

### Requirement: Scope — knowledge is crew-scoped, never person-scoped
An observed fact SHALL live with the crew (room) that learned it and SHALL inform only that crew's surfaces. The system SHALL NOT aggregate observed facts across crews into a person-level profile, and no read path SHALL join another crew's observations into a suggestion. A fact learned in one crew follows a person into another crew only by being performed there too.

#### Scenario: A fact stays in its room
- **WHEN** a preference was learned from acts inside one crew and a different crew's surface is assembled
- **THEN** that preference contributes nothing to the other crew's suggestions

#### Scenario: No cross-crew profile exists
- **WHEN** any code path reads observed knowledge about a participant
- **THEN** it reads per-crew observations — there is no person-level aggregate to read

### Requirement: Surfacing — improved defaults, never displayed facts
Observed knowledge SHALL surface only as better defaults — ranking, weighting, omission, timing — and SHALL NOT be rendered as a fact about a person: no profile card, no attribute list, no insights panel, no explanation that names what the system knows ("X is gluten-free", "X is free Thursday"). The coordinator SHALL receive outputs (better drafts and suggestions), never access (a briefing view of their friends). No UI SHALL render a person as a record.

#### Scenario: A preference improves ranking silently
- **WHEN** a suggestion is assembled for a group whose member's acts imply a preference
- **THEN** options are ranked or filtered accordingly, and no surface states the preference or attributes it to the person

#### Scenario: No screen lists what Bonfire knows
- **WHEN** any participant views any surface about another person
- **THEN** no enumeration of known facts, preferences, or attributes about that person is rendered — even facts they volunteered

### Requirement: Decay — facts re-confirm or quietly fade
Observed facts SHALL carry recency-decaying weight: a fact not re-confirmed by ongoing behavior SHALL progressively lose influence on defaults, and time-bound life facts SHALL auto-expire rather than persist indefinitely. Forgetting on schedule is a feature; a system still acting on a stale life event is the failure case. Deliberate declared signals (intents, taps) do not decay — they are withdrawable by their author instead.

#### Scenario: An unconfirmed fact loses weight
- **WHEN** an observed preference has not recurred in the participant's acts for a long period
- **THEN** its influence on suggestions diminishes toward none, without any surface announcing the change

#### Scenario: A time-bound fact expires
- **WHEN** an observed time-bound life fact passes its natural horizon
- **THEN** it stops influencing suggestions entirely, automatically

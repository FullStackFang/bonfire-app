# pulse-link-unfurl

## Purpose

Every crew and pulse is shareable as its own link that unfurls into a curated, branded, evergreen preview card in chat apps — and opens applessly, with no login, for whoever taps it. (Synced from `add-live-pulse`, with the original spark/container vocabulary carried forward under the current names: pulse/crew.)

## Requirements

### Requirement: Each object is shareable as its own link

A crew and a pulse SHALL each have their own shareable link. A pulse that belongs to a crew SHALL, on its own page, show a way back to its parent crew. Either link SHALL be droppable into a chat on its own.

#### Scenario: A crew link opens the board

- **WHEN** a person opens a crew link
- **THEN** they land on that crew's board (presence plus its live pulses)

#### Scenario: A pulse link opens that single pulse

- **WHEN** a person opens a pulse link
- **THEN** they land on that one pulse's participation surface

#### Scenario: A child pulse links back to its crew

- **WHEN** a pulse that belongs to a crew is opened by its own link
- **THEN** the page shows a reference back to its parent crew (a breadcrumb)

#### Scenario: A standalone pulse shows no parent reference

- **WHEN** a pulse with no crew is opened by its link
- **THEN** no parent-crew reference is shown

### Requirement: A pasted link unfurls into a curated branded card

When a link is pasted into a chat app, it SHALL produce a curated preview card carrying the object's identity (its name, or the pulse's title/place/time) and Bonfire branding — not a bare URL.

#### Scenario: A crew link previews with the board's name

- **WHEN** a crew link is pasted into a chat
- **THEN** the preview shows the crew's name and Bonfire branding
- **AND** the preview invites the reader to open it (e.g. "tap to see who's around")

#### Scenario: A pulse link previews with its title, place, and time

- **WHEN** a pulse link is pasted into a chat
- **THEN** the preview shows the pulse's title, place, and time with Bonfire branding

### Requirement: The unfurl preview is evergreen and never shows live state

The preview card SHALL NOT display a live or changing count or roster. It SHALL remain valid and inviting regardless of how the object's state changes after the link is shared, because chat apps freeze the preview at share time.

#### Scenario: The card carries no live count

- **WHEN** any link's preview is generated
- **THEN** it shows no count of who is in or around

#### Scenario: The card stays valid as state changes

- **WHEN** the object's presence or participation changes after the link was shared
- **THEN** the already-shared preview remains accurate (it never claimed a live number) and still invites a tap

### Requirement: The preview is fetchable anonymously and the page opens with no install or login

A chat app's link crawler SHALL be able to fetch the preview with no session, cookie, or credential, and a person tapping the link SHALL reach the live object with no app install and no login.

#### Scenario: The crawler fetches the preview without a session

- **WHEN** a chat app's link crawler requests the preview for a link
- **THEN** it receives the card without needing any cookie or credential

#### Scenario: Tapping the link opens straight to the object

- **WHEN** a person taps a shared link
- **THEN** the live object opens directly, with no install step and no login wall

### Requirement: The preview card never renders arbitrary participant text

To protect the shared link's reputation in other people's chats, the preview card SHALL be built only from creator-set fields (the crew name, or the pulse's title/place/time) and SHALL NOT render participant notes or other free-flowing content.

#### Scenario: Participant notes do not reach the card

- **WHEN** participants add notes to a crew or pulse
- **THEN** those notes never appear in the link's preview card

### Requirement: Pulse links are not search-indexable

Because a link is the only access control to its object, links SHALL be excluded from search-engine indexing.

#### Scenario: A pulse link is marked not to be indexed

- **WHEN** a search-engine crawler requests a crew or pulse page
- **THEN** the page signals that it must not be indexed

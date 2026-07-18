# admin-review-gallery

## Purpose

A persistent, growable home under `/admin` for visual review artifacts (e.g. the built-screens poster). Reviews come from a code registry; each is rendered verbatim inside an isolated iframe so a self-contained HTML poster displays exactly as authored, sandboxed from the app. Adding a review is one registry entry plus its content. Gating is provided by [admin-access](../admin-access/spec.md).

## Requirements

### Requirement: Review gallery index

The system SHALL provide an `/admin` index that lists the available review artifacts from a registry, each with a title and a link to its own page. The gallery SHALL be growable: adding a review is a single registry entry plus its content, with no change to the gating or rendering code.

#### Scenario: Index lists seeded reviews

- **WHEN** an admin opens `/admin`
- **THEN** the page lists each review in the registry, including the built-screens review, each linking to its own route

#### Scenario: Unknown review slug is not found

- **WHEN** an admin opens `/admin/reviews/<slug>` for a slug not in the registry
- **THEN** the system responds with 404

### Requirement: Verbatim isolated rendering of a review

The system SHALL render each review's self-contained HTML verbatim inside an isolated frame so its styles do not leak into or inherit from the app, and the frame SHALL size to the content so the poster is not inner-scrolled.

#### Scenario: Built-screens poster renders as authored

- **WHEN** an admin opens the built-screens review
- **THEN** the poster HTML renders inside an isolated frame with its own styles
- **AND** the frame height fits the poster content

### Requirement: Built-screens review is seeded

The system SHALL seed the gallery with a "built screens" review containing the poster that renders the shipped UI for the BUILT insights (M1 again-engine, M3 deliberation caps, D2 repetition mechanics).

#### Scenario: Seeded review is present on first deploy

- **WHEN** the gallery is first available
- **THEN** the built-screens review exists in the registry and is openable by an admin

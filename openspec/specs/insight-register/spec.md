# insight-register

## Purpose

A durable, versioned register of external research insights at `design/growth-story/INSIGHT-REGISTER.md` — one row per insight, each carrying a stable ID, a verdict from the study, a build status from a fixed vocabulary, and an evidence pointer; plus the convention for keeping it current and promoting build-next items into OpenSpec changes.

## Requirements

### Requirement: Durable insight register document

The system SHALL maintain a durable, versioned register at `design/growth-story/INSIGHT-REGISTER.md` that records external research insights, each as a row with a stable ID, a verdict, a build status, and (where applicable) an evidence pointer. The register SHALL be discoverable from `design/growth-story/ROADMAP.md` via a one-line cross-reference.

#### Scenario: Register exists and is linked from the roadmap

- **WHEN** a reader opens `design/growth-story/ROADMAP.md`
- **THEN** it contains a one-line pointer to `design/growth-story/INSIGHT-REGISTER.md`
- **AND** that file exists and lists insights in a table with columns for ID, insight, verdict, status, and evidence

#### Scenario: Every insight has a stable ID

- **WHEN** an insight is recorded in the register
- **THEN** it carries a permanent ID (mentor directions `D1`–`D6`, proposed mechanics `M1`–`M4`, and prefixed IDs for future studies)
- **AND** the ID is never reassigned to a different insight

### Requirement: Fixed verdict and status vocabulary

The register SHALL classify each insight on two axes drawn from fixed vocabularies. The **verdict** SHALL be one of `VALIDATED`, `VALIDATED-INVERTED`, `ACQUISITION-TACTIC`, or `PARK`. The **status** SHALL be one of `BUILT`, `PARTIAL`, `BUILD-NEXT`, `INVERTED`, `PARKED`, or `DEFERRED`. Any row whose status is `BUILT`, `PARTIAL`, or `INVERTED` MUST carry an evidence pointer to the spec, code path, or roadmap phase that backs it.

#### Scenario: Built insight cites evidence

- **WHEN** an insight is marked `BUILT` or `PARTIAL`
- **THEN** its row includes an evidence pointer (a spec name, a file path, or a roadmap phase)

#### Scenario: Status value is from the fixed set

- **WHEN** a status is assigned to any row
- **THEN** it is exactly one of `BUILT`, `PARTIAL`, `BUILD-NEXT`, `INVERTED`, `PARKED`, `DEFERRED`
- **AND** the verdict is exactly one of `VALIDATED`, `VALIDATED-INVERTED`, `ACQUISITION-TACTIC`, `PARK`

### Requirement: 2026-07-16 interview study seeded

The register SHALL contain, on creation, a section for the 2026-07-16 consumer interview study covering all six mentor directions (`D1`–`D6`) and all four proposed mechanics (`M1`–`M4`), each with a verdict, a status, and an evidence pointer for anything not unbuilt.

#### Scenario: All ten study insights present

- **WHEN** the register is created
- **THEN** it contains rows `D1` through `D6` and `M1` through `M4`
- **AND** the already-shipped insights (`D2`, `M1`, `M3`) are marked `BUILT` with evidence pointing at `relationship-intelligence`/`who-is-around`, `again-engine`, and `plan-coordination` respectively

#### Scenario: Inverted and parked directions recorded as decisions

- **WHEN** a direction was validated only in inverted form (`D3` event aggregation) or should be parked (`D6` B2B conferences)
- **THEN** its row records the verdict (`VALIDATED-INVERTED` / `PARK`) and status (`INVERTED` / `PARKED`) rather than being omitted

### Requirement: Maintenance and promotion convention

The register SHALL document a maintenance convention stating that it is updated when a new external study lands, when a `BUILD-NEXT` item is promoted to an OpenSpec change, and when a build is verified end-to-end. A `BUILD-NEXT` item SHALL be promoted to implementation only through a separate OpenSpec change created via `opsx:propose`; this change does not itself implement any insight.

#### Scenario: Promoting a build-next item

- **WHEN** a `BUILD-NEXT` insight is selected for implementation
- **THEN** a new OpenSpec change is created via `opsx:propose`
- **AND** the register row is updated to link that change and its status moves toward `PARTIAL`/`BUILT` as work verifies

#### Scenario: This change implements no insight

- **WHEN** this change is applied
- **THEN** only the register document and the roadmap pointer are added or edited
- **AND** no spec under `openspec/specs/` and no application code is modified

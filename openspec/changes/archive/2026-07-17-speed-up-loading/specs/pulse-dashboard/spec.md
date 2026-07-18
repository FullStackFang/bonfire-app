## ADDED Requirements

### Requirement: Dashboard reads are bounded

A dashboard render SHALL perform a bounded number of database queries that does not grow with the viewer's number of plans, pulses, or crews (set-based reads over the capped item lists; no per-item query loops). List caps SHALL be applied in SQL (`LIMIT`), not by fetching all rows and truncating in application code. Analytics writes SHALL happen after the response is sent and SHALL never delay first paint.

#### Scenario: Many plans do not multiply queries
- **WHEN** a viewer with 10 plans (the dash cap) loads `/p`
- **THEN** the dash render issues the same bounded number of queries as a viewer with 1 plan, and every plan card renders with the same state, winner label, and ember standing as before

#### Scenario: Long pulse history does not inflate the read
- **WHEN** a viewer who has created or responded to many ended pulses loads `/p`
- **THEN** the "Earlier" read is capped in SQL and does not transfer rows beyond the cap (plus the viewer's live pulses)

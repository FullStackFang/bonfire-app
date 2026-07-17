# app-navigation

## MODIFIED Requirements

### Requirement: Web pulse navigation

The web pulse app SHALL render the navbar once across all `/p` surfaces with three tabs — Home, Events, Groups — using flame, calendar, and people icons respectively, followed by an auth chip. The active tab SHALL be determined by the current route. Home SHALL link to the existing rail at `/p`; Events and Groups SHALL link to their respective list routes. The auth chip SHALL use a person icon and follow the same chunky-chip visual states as the tabs: when the viewer is unverified it SHALL be labeled "Log in" and link to `/p/login`; when the viewer is verified it SHALL be labeled "Account" and link to `/p/account`. The auth chip SHALL be active on the route it links to.

#### Scenario: Bar persists across pulse surfaces
- **WHEN** the viewer navigates between `/p`, a pulse page, and a crew page
- **THEN** the same navbar — three tabs plus the auth chip — remains fixed at the bottom of the `max-w-md` column on each

#### Scenario: Active tab tracks the route
- **WHEN** the viewer is on the Groups list route
- **THEN** the Groups tab is the ember active chip and Home, Events, and the auth chip are inactive

#### Scenario: Home reaches the rail
- **WHEN** the viewer taps Home
- **THEN** they arrive at `/p`, the existing dashboard rail, unchanged

#### Scenario: Signed-out chip offers login
- **WHEN** an unverified viewer renders any `/p` surface
- **THEN** the navbar's auth chip is a person icon labeled "Log in" linking to `/p/login`

#### Scenario: Signed-in chip offers account
- **WHEN** a verified viewer renders any `/p` surface
- **THEN** the navbar's auth chip is labeled "Account", links to `/p/account`, and shows as the active chip while on that route

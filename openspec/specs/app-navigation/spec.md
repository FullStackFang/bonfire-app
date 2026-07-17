# app-navigation

## Purpose

The shared bottom navbar — its visual system, states (active/inactive/live), accessibility and safe-area behavior — plus the web pulse app's navigation destinations (Home rail, Events list, Groups list) and the mobile tab-bar restyle over its existing destinations.

## Requirements

### Requirement: Chunky-chip navbar visual system

The navbar SHALL present each tab as a structural-press "chunky chip": a face resting on a hard, non-blurred offset shadow layer, consistent with the app's existing button vocabulary. The active tab SHALL use an ember face (`--ember`, `#f05846`) with a white icon and an ember-deep (`--ember-deep`, `#a52a24`) offset shadow. Inactive tabs SHALL use a hearth face (`--hearth`) with a smoke (`--smoke`) icon, a `1.5px` ash (`--ash`) border, and a shadow-warm (`--shadow-warm`, `#c8b8b1`) offset shadow. The bar surface SHALL be hearth with a `0.5px` ash hairline along its top edge. Tabs SHALL be icon-only. Ember SHALL be used only for the active state, never decoratively. No tab shadow SHALL use blur.

#### Scenario: Active tab is an ember chunky chip
- **WHEN** a navbar renders with one tab marked active
- **THEN** that tab shows an ember face with a white icon and a hard ember-deep offset shadow with no blur

#### Scenario: Inactive tabs are hearth chunky chips
- **WHEN** a navbar renders
- **THEN** every non-active tab shows a hearth face, a smoke-colored icon, a 1.5px ash border, and a hard shadow-warm offset shadow

#### Scenario: Press animates the face onto its shadow
- **WHEN** the user presses a tab and `prefers-reduced-motion` is not set
- **THEN** the tab face translates down onto its offset shadow and the offset collapses, then restores on release

### Requirement: Live signal on a tab

A tab SHALL display a spark dot (`--spark`, `#54b05a`) when its destination has something live now. The dot SHALL not be shown otherwise.

#### Scenario: Live pulse shows the spark on Events
- **WHEN** the viewer has at least one live pulse and the Events tab is rendered
- **THEN** a spark dot appears on the Events tab

#### Scenario: No live activity hides the spark
- **WHEN** the viewer has no live pulses
- **THEN** no spark dot is shown on the Events tab

### Requirement: Accessible, safe-area-aware bar

The navbar SHALL honor `prefers-reduced-motion` by omitting the press translation while keeping state colors. Each tab SHALL expose an accessible label naming its destination in plain words (Home, Events, Groups). The bar SHALL respect the device bottom safe-area inset, and hosting layouts SHALL reserve bottom space so no surface content is hidden behind the fixed bar.

#### Scenario: Reduced motion keeps state, drops movement
- **WHEN** `prefers-reduced-motion: reduce` is set and the user activates a tab
- **THEN** the active/inactive colors update but no press translation animates

#### Scenario: Content clears the fixed bar
- **WHEN** any hosting surface renders with the fixed navbar
- **THEN** the surface's scrollable content ends above the bar and nothing is obscured by it, including within the bottom safe-area inset

#### Scenario: Screen reader announces destinations
- **WHEN** a screen reader focuses a tab
- **THEN** it announces the tab's plain-word destination even though no text label is visible

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

### Requirement: Events destination

The Events tab SHALL open a list of the viewing participant's events (live and earlier), read via the existing pulse repository and serialized with the existing dashboard serializer, rendered with the existing event card markup. It SHALL introduce no new data source.

#### Scenario: Events list shows the viewer's events
- **WHEN** a verified participant with events opens the Events tab
- **THEN** their live and earlier events are listed using the existing event card presentation

#### Scenario: Events empty state
- **WHEN** a participant with no events opens the Events tab
- **THEN** an empty state is shown that teaches the next action rather than displaying "nothing here"

### Requirement: Groups destination

The Groups tab SHALL open a list of the viewing participant's groups, read via the existing crew repository and serialized with the existing dashboard serializer, rendered with the existing group card markup. Labels SHALL use the plain word "Groups", never the internal term. It SHALL introduce no new data source.

#### Scenario: Groups list shows the viewer's groups
- **WHEN** a verified participant in one or more groups opens the Groups tab
- **THEN** their groups are listed using the existing group card presentation, with the viewer's own status only

#### Scenario: Groups empty state
- **WHEN** a participant in no groups opens the Groups tab
- **THEN** an empty state is shown that teaches the next action

### Requirement: Mobile tab-bar restyle

The mobile app SHALL replace Expo Router's default tab bar with a custom renderer that draws the chunky-chip visual system over the app's existing destinations (Fire, Map, Group), icon-only, preserving the current Ionicons and using the shared `light` design tokens. Mobile navigation destinations and routing behavior SHALL be unchanged.

#### Scenario: Mobile shows chunky chips
- **WHEN** the mobile app renders its tab shell
- **THEN** the three existing tabs appear as chunky chips with the active tab as an ember face and inactive tabs as hearth faces

#### Scenario: Mobile destinations unchanged
- **WHEN** the user taps a mobile tab
- **THEN** it navigates to the same screen it did before the restyle

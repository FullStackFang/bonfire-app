# landing-page

## Purpose

The public front door at `/`: strangers get an indexable marketing page telling the pulse-to-crew story; returning participants skip straight to their dashboard.

## Requirements

### Requirement: Stranger-vs-participant routing at the root

The root route `/` SHALL render the public landing page only for a device with no participant identity. A device that already has a participant cookie SHALL be redirected to `/p` (the participant dashboard). Resolving identity SHALL be read-only and MUST NOT create or mutate a participant.

#### Scenario: First-time visitor sees the landing page

- **WHEN** a device with no participant cookie requests `/`
- **THEN** the public landing page is rendered
- **AND** no participant cookie is created by the request

#### Scenario: Returning participant is sent to the dashboard

- **WHEN** a device whose cookie resolves to a participant requests `/`
- **THEN** the response redirects to `/p`
- **AND** the landing page markup is not rendered

#### Scenario: Stale or unresolvable cookie is treated as a stranger

- **WHEN** a device presents a participant cookie that does not resolve to any participant
- **THEN** the landing page is rendered rather than redirecting to `/p`

### Requirement: Landing page tells the pulse-to-crew story

The landing page SHALL present, in scroll order, a hero that names the product thesis, a "how it works" explanation of dropping a pulse and a crew forming, a "why it works" section of product differentiators, and a closing restatement of the thesis. Copy SHALL follow the reviewed `design/landing.html` mockup and MUST NOT present fabricated testimonials, press quotes, or usage statistics as real.

#### Scenario: Full narrative is present

- **WHEN** the landing page is rendered
- **THEN** it contains the hero headline, a how-it-works section describing drop-a-pulse → tap-in → crew-forms, a why-it-works section, and a closing call to action

#### Scenario: No fabricated social proof

- **WHEN** the landing page is rendered
- **THEN** it contains no testimonials, press logos, or usage counts presented as genuine

### Requirement: Landing CTAs route into the app

Primary calls to action ("Drop a pulse") SHALL link to `/p/new`. Sign-in affordances in the header and footer SHALL link to `/p/login`.

#### Scenario: Primary CTA opens pulse creation

- **WHEN** the visitor activates a "Drop a pulse" call to action
- **THEN** they navigate to `/p/new`

#### Scenario: Sign-in link opens the login surface

- **WHEN** the visitor activates the "Sign in" link
- **THEN** they navigate to `/p/login`

### Requirement: Landing page is indexable with marketing metadata

Unlike the participant-scoped `/p` surfaces (which are excluded from indexing), the landing page SHALL be indexable and SHALL expose a marketing title, description, and Open Graph metadata suitable for link previews.

#### Scenario: Search engines may index the landing page

- **WHEN** a crawler requests `/`
- **THEN** the page's robots metadata permits indexing
- **AND** a marketing title and description are present

### Requirement: Motion degrades gracefully

Landing-page motion (scroll-triggered reveals, the header's light-to-dark transition, the self-animating hero card, and drifting spark particles) SHALL be progressive enhancement. Without JavaScript the full content SHALL be visible and legible. When the visitor prefers reduced motion, animations SHALL collapse to a static end state rather than looping or moving.

#### Scenario: Content is complete without JavaScript

- **WHEN** the landing page is rendered with JavaScript disabled
- **THEN** all sections and their content are visible and readable

#### Scenario: Reduced-motion visitors get a static page

- **WHEN** the visitor's browser reports `prefers-reduced-motion: reduce`
- **THEN** scroll reveals, the hero card demo, and spark particles are shown in a static resting state with no looping animation

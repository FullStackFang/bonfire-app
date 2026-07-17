## Why

The web app's front door (`/`) unconditionally redirects to `/p`, so a first-time visitor with no context lands inside a participant dashboard. There is no public surface that explains what Bonfire is or why to drop a pulse. Strangers need a marketing entry point; participants should still go straight to their dash.

## What Changes

- Replace the unconditional `redirect('/p')` in `app/page.tsx` with viewer-aware routing: any device with a participant cookie redirects to `/p`; a device with no cookie (a true stranger) sees a new public landing page.
- Add a public, indexable landing page (its own scoped stylesheet + a small client island) that tells the pulse → crew story: a cream hero with a self-demoing pulse card, a how-it-works band, a dark "why it works" band, and a near-black closing with drifting sparks.
- Landing CTAs route into the existing app: "Drop a pulse" → `/p/new`; "Sign in" → `/p/login`.
- Give `/` real, indexable OG/SEO metadata (title, description, `robots: index`) — the opposite of the participant-scoped `/p` surfaces, which stay `robots: { index: false }`.
- Motion (scroll reveals, the header's day-to-night transition, the self-demoing hero card, drifting sparks) collapses to a static, legible page under `prefers-reduced-motion` and without JS.

## Capabilities

### New Capabilities
- `landing-page`: the public marketing front door at `/` — who sees it (stranger vs. participant routing), what it says, how it converts (CTAs into `/p/new` and `/p/login`), its indexable metadata, and its motion/accessibility contract.

### Modified Capabilities
<!-- No existing spec's requirements change. app-navigation covers in-app nav chrome; the landing is a new public surface, not a nav change. -->

## Impact

- `apps/web/app/page.tsx` — routing logic changes from unconditional redirect to viewer-aware branch; gains marketing metadata.
- New: `apps/web/app/landing.client.tsx` (client island for reveals + header behavior) and `apps/web/app/landing.css` (scoped stylesheet, reuses design-system tokens; does not use the `.bonfire-pulse` app-shell class).
- Reuses existing `getViewer()` from `lib/pulse/identity` (read-only, never mutates) and the font CSS variables already set on `<html>` by the root layout.
- No database, API, or dependency changes. Design source: the reviewed `design/landing.html` mockup.

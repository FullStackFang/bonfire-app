## Why

Both apps make the user find their way around by chance: the web pulse app has no persistent navigation at all (every `/p` surface links home only through the wordmark), and the mobile app uses Expo's default flat tab bar, which is off-brand against the app's structural-press button language. A single shared navbar gives the product one coherent way to move between the few things a person actually manages, without adding any of the app-shell chrome the doctrine forbids (no feed, no profile destination).

## What Changes

- Introduce one shared bottom-navbar visual system: a fixed hearth-surface bar with a top ash hairline and three icon-only **chunky-chip** tabs. Active = ember face, white icon, hard offset shadow on ember-deep, pressing down onto its shadow on tap. Inactive = hearth face, smoke icon, ash border, offset shadow on shadow-warm. A green spark dot marks a tab when something is live now. Honors `prefers-reduced-motion` and the bottom safe-area inset.
- **Web** (`apps/web/app/p/`): add the bar to the `/p` layout with tabs **Home · Events · Groups** (flame · calendar · people). Add two new thin list routes for **Events** and **Groups** as the tab destinations, built from existing repo reads, `serializeDash`, and the dash's card markup. Home continues to point at the existing rail (`/p`).
- **Mobile** (`apps/mobile/app/(app)/`): restyle only. Replace Expo's default tab bar with a custom renderer that draws the same chunky-chip look for the app's existing **Fire · Map · Group** tabs, icon-only, Ionicons preserved, `light` tokens from `@bonfire/ui-tokens`. No change to mobile destinations or product behavior.

## Capabilities

### New Capabilities
- `app-navigation`: The shared bottom navbar — its visual system, states (active/inactive/live), accessibility and safe-area behavior — plus the web pulse app's navigation destinations (Home rail, Events list, Groups list) and the mobile tab-bar restyle over its existing destinations.

### Modified Capabilities
<!-- None: the pulse dashboard, crews, and pulse-broadcast requirements are unchanged. The navbar sits alongside existing surfaces and the new Events/Groups pages reuse existing reads without altering their contracts. -->

## Impact

- **Web, new:** `apps/web/app/p/layout.tsx` (mount the bar + bottom padding); a new `PulseTabBar` client component; new Events and Groups route folders under `apps/web/app/p/`. Reuses `lib/pulse/repo`, `lib/pulse/serialize`, and card markup from `p/page.tsx` + `p/ui.client.tsx`. No data layer, schema, or API changes.
- **Mobile, restyle:** `apps/mobile/app/(app)/_layout.tsx` gains a custom `tabBar`; a new tab-bar component under `apps/mobile/components/`. Consumes existing `@bonfire/ui-tokens` and Ionicons. No route, data, or auth changes.
- **Shared:** no new dependencies. Design tokens already exist (ember, ember-deep, shadow-warm, spark, ash, hearth, smoke).

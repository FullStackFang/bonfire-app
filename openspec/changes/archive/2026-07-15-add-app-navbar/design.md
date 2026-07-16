## Context

The web pulse app (`apps/web/app/p/`) is a mobile-first (`max-w-md`), server-rendered set of surfaces (dash/rail, single pulse, crew board, availability) with no persistent navigation — the only global affordance is the `BrandRow` wordmark linking home. The mobile app (`apps/mobile`) already has a bottom tab bar (Fire · Map · Group) but uses Expo Router's default flat `Tabs` chrome, which does not match the app's structural-press button vocabulary documented in `docs/design.md` (chunky faces on hard offset shadow layers, ember for active/live state only, Ionicons throughout, no ambient blur).

This design was validated through a brainstorming + impeccable visual pass. The user selected an icon-only bar where **every tab is a chunky-press button** (the "all chunky chips" variant), and chose to keep mobile's existing destinations while adopting the shared look.

Constraints: Next.js 16.2.5 in `apps/web` (App Router; read the bundled docs before writing route/layout code). Expo Router 6 + Reanimated 4 + NativeWind 4 on mobile. Design doctrine is strict: no feed, no profile destination, absence never displayed, pure black forbidden (use Coal), ember never decorative.

## Goals / Non-Goals

**Goals:**
- One shared navbar visual system expressed on both platforms: chunky-chip tabs, ember active face, hearth inactive faces, spark-dot live signal, icon-only.
- Give the web pulse app real persistent navigation with three managed destinations: Home, Events, Groups.
- Make Events and Groups reachable as their own list surfaces without building any new data layer.
- Bring mobile's tab bar into the app's button vocabulary without changing what it navigates to.

**Non-Goals:**
- No change to mobile's destinations, routes, map, or presence behavior (restyle only).
- No new data model, migration, API route, or dependency.
- No profile/settings/identity tab — identity chrome stays contextual (the existing recovery island), per doctrine.
- No redesign of the dash, crew board, or pulse pages themselves beyond adding bottom padding so content clears the fixed bar.

## Decisions

**1. Every tab is a chunky-press button (not tint or notch).**
Chosen over the flat "ember tint" and "icon-only notch" variants. Rationale: the app's whole interaction language is structural depth; a flat tab bar reads as borrowed OS chrome. Active tab = ember face (`--ember`) + white icon + `box-shadow: 0 4px 0 var(--ember-deep)`; inactive = hearth face + smoke icon + `1.5px` ash border + `box-shadow: 0 4px 0 var(--shadow-warm)`. Press translates the face down `4px` and drops the shadow (meets it), matching the existing `ChunkyPressable`/`CTAButton` mechanic. No blur on any shadow.

**2. Icon-only on both platforms; Home uses a flame.**
Dropping mobile's current text labels so both apps read as one system. Home is a flame, not a house, because doctrine frames opening the app as "checking the hearth." Web tabs: flame (Home) · calendar (Events) · people (Groups). Mobile keeps its Ionicons (`flame`, `map`, `people`) under the new chip treatment.

**3. Web bar is a single client component mounted in the `/p` layout.**
`PulseTabBar` (client) rendered once in `apps/web/app/p/layout.tsx`, positioned fixed at the bottom of the `max-w-md` column; the layout adds bottom padding (≈ bar height + safe-area) so no surface hides content behind it. Active state derives from `usePathname()`. Alternative considered — rendering the bar per-page — rejected: duplication and inconsistent active state.

**4. Events and Groups are thin list pages that reuse existing reads.**
`Events` → viewer's live + earlier pulses via `repo.pulsesForParticipant`; `Groups` → viewer's crews via `repo.crewsForParticipant`; both serialized with `serializeDash` and rendered with the card markup already living in `p/page.tsx` + `p/ui.client.tsx`. Home (`/p`) stays the full rail (events + groups + earlier). Alternative considered — making Events/Groups filtered client views of the dash — rejected: real routes give the tabs honest URLs and keep active state trivial. Mild redundancy (Home shows everything, the subsets show slices) is accepted in exchange for dead-simple pages.

**5. Mobile uses a custom `tabBar` renderer, not per-screen chrome.**
Replace the default bar via the `tabBar` prop on `<Tabs>` in `(app)/_layout.tsx` with a component that reads `state`/`descriptors` and draws the chunky chips from `light` tokens in `@bonfire/ui-tokens`. Keeps Expo Router's navigation intact; only the presentation changes.

**6. Shared labels are plain words.**
User-facing labels are Home / Events / Groups (and Fire / Map / Group on mobile), never the internal domain terms "pulse"/"crew". Since the bar is icon-only, these live in `aria-label`/accessibility labels, not visible text.

## Risks / Trade-offs

- **Fixed bar overlapping content on short viewports / iOS Safari toolbars** → layout reserves bottom padding using `env(safe-area-inset-bottom)`; verify on the `/p` surfaces that already own their scroll container.
- **Home/Events/Groups redundancy could confuse** ("why is my event in two places?") → accepted; Home is explicitly the launchpad and the subsets are focused views. Revisit only if it tests poorly.
- **Two implementations of one visual system drift over time** → mitigated by pinning both to the same named tokens and documenting the chip spec in the capability spec; there is no shared runtime between RN and web to unify them.
- **Icon-only reduces discoverability vs labeled tabs** → mitigated by conventional icons, ember active state, and only three destinations; accessibility labels remain for screen readers.
- **Next.js 16 App Router specifics** → read `apps/web/node_modules/next/dist/docs/` for layout/route conventions before implementing; do not assume 13–15 patterns.

## Migration Plan

Additive only. Web: new component + two new routes + layout padding; nothing removed, existing surfaces unchanged. Mobile: swap the tab bar presentation; destinations preserved. Rollback = revert the layout mount (web) or the `tabBar` prop (mobile); no data or schema state involved.

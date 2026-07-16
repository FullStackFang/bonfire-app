## 1. Web — chunky-chip navbar component

- [x] 1.1 Read the Next.js 16 App Router layout/route docs in `apps/web/node_modules/next/dist/docs/` before writing any route or layout code
- [x] 1.2 Add chunky-chip navbar styles to `apps/web/app/p/pulse.css` (or a co-located module): hearth bar with 0.5px ash top hairline; ember active face + white icon + `0 4px 0 var(--ember-deep)`; hearth inactive face + smoke icon + 1.5px ash border + `0 4px 0 var(--shadow-warm)`; press translates face down 4px and collapses the offset; no blur on any shadow
- [x] 1.3 Create `PulseTabBar` client component (`apps/web/app/p/nav.client.tsx` or similar) with three icon-only tabs — Home (flame), Events (calendar), Groups (people) — deriving the active tab from `usePathname()` and exposing plain-word `aria-label`s
- [x] 1.4 Add a green spark dot (`--spark`) to the Events tab, driven by a `live` prop passed from the layout when the viewer has ≥1 live pulse
- [x] 1.5 Honor `prefers-reduced-motion` (drop the press translation, keep state colors) and add `env(safe-area-inset-bottom)` handling

## 2. Web — layout wiring

- [x] 2.1 Mount `PulseTabBar` once in `apps/web/app/p/layout.tsx`, fixed to the bottom of the `max-w-md` column
- [x] 2.2 Reserve bottom space in the layout (padding = bar height + safe-area inset) so no `/p` surface hides content behind the bar
- [x] 2.3 Pass the live-pulse flag to the bar (read via existing `repo.pulsesForParticipant` for the current viewer in the layout, or lift the existing dash read) without adding a new data source

## 3. Web — Events and Groups destinations

- [x] 3.1 Extract the event/pulse card markup and the group/crew card markup from `apps/web/app/p/page.tsx` into reusable pieces (co-locate with `p/ui.client.tsx`) so the dash and the new pages share one presentation
- [x] 3.2 Create the Events route under `apps/web/app/p/` listing the viewer's live + earlier events via `repo.pulsesForParticipant` + `serializeDash`, using the shared event card and an empty state that teaches the next action
- [x] 3.3 Create the Groups route under `apps/web/app/p/` listing the viewer's groups via `repo.crewsForParticipant` + `serializeDash`, using the shared group card (viewer's own status only) and a teaching empty state
- [x] 3.4 Confirm Home (`/p`) still renders the full rail unchanged and that its cards use the shared markup from 3.1

## 4. Mobile — chunky-chip tab bar restyle

- [x] 4.1 Create a custom tab-bar component under `apps/mobile/components/` that reads Expo Router `state`/`descriptors` and renders the chunky-chip system (ember active face + hard offset shadow, hearth inactive faces) from `light` tokens in `@bonfire/ui-tokens`, icon-only
- [x] 4.2 Wire it via the `tabBar` prop on `<Tabs>` in `apps/mobile/app/(app)/_layout.tsx`, preserving the existing Fire · Map · Group destinations and their Ionicons; remove the default label text
- [x] 4.3 Honor `prefers-reduced-motion` (static, no press translate) and keep haptics/state colors per doctrine

## 5. Verification

- [x] 5.1 `npm run lint:web` and `npm run build:web` pass clean
- [x] 5.2 Manually verify on `/p`, a pulse page, and a crew page: the bar is fixed-bottom, active state tracks the route, nothing overlaps content, and the spark shows only when a pulse is live
- [x] 5.3 Verify the Events and Groups pages list the correct items and show teaching empty states
- [x] 5.4 Verify the mobile tab bar renders the chunky-chip treatment (active ember) on mock data and that each tab still navigates to its original screen

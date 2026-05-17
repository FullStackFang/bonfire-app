# Tasks

Implement in order. Each task delivers a user-observable change and leaves the app in a runnable state.

## 1. RSVP persistence: attendees on MapEvent

- [ ] 1.1 Extend `MapEvent` in `apps/mobile/lib/mockEventStore.ts` with `attendee_ids: string[]`.
- [ ] 1.2 Add `joinMockEvent(id, userId)` and `leaveMockEvent(id, userId)` — idempotent, notify subscribers.
- [ ] 1.3 Seed every entry in `apps/mobile/lib/mockSeeds.ts` (`nycMapEvents`, `ithacaMapEvents`) with a deterministic attendee list. Port the per-event hash logic out of `useEnrichment` so the seeded count and visible-three match what the detail screen used to invent.
- [ ] 1.4 Delete `useEnrichment` from `apps/mobile/app/event/[id].tsx`. Read `attendee_ids` straight from the event; derive `going = !!user && event.attendee_ids.includes(user.id)`; build the visible-three avatar slice from `attendee_ids` + `mockUsers`.
- [ ] 1.5 `toggleGoing` calls `joinMockEvent` / `leaveMockEvent` with a success/selection haptic. Remove the local `going` `useState`.
- [ ] 1.6 Manually verify: open a seeded event, tap "I'm going!", confirm the count bumps by one, your avatar appears in the stack, the button shows "You're in!". Close and reopen — state survives.

## 2. Headcount chip on EventPin

- [ ] 2.1 In `apps/mobile/components/map/EventPin.tsx`, append a compact `AvatarStack` (size `xs`, max 3) to the pill when `attendee_ids.length > 0`.
- [ ] 2.2 When `attendee_ids.length > 3`, render a trailing `+N` badge inside the stack (use AvatarStack's existing overflow behaviour if available, otherwise add a small chip).
- [ ] 2.3 Sanity-check pill width and pin anchor offset in `apps/mobile/app/(app)/index.tsx` — the wider pill may need its `translateX` recomputed so the notch still sits on the geo point.
- [ ] 2.4 Manually verify on the home map: pins with attendees show the stack; pins with none look unchanged.

## 3. Upcoming events: starts_at + pin variant

- [ ] 3.1 Add `starts_at: string` to `MapEvent` and to all seeds. For existing seeds set `starts_at = created_at` so they stay "live" as today.
- [ ] 3.2 Add a derived `getEventStatus(event, now): "upcoming" | "live" | "ended"` helper in `apps/mobile/lib/mockEventStore.ts` (or a sibling util) — `now < starts_at` → upcoming; `starts_at ≤ now < expires_at` → live; otherwise ended. The host `live_now` boolean can flip an event from upcoming to live early but cannot push a live event back to upcoming.
- [ ] 3.3 Update `EventPin` to render an **upcoming** variant: dashed cream border, `time-outline` icon, label "starts in 25m" (countdown to `starts_at`, not to expiry).
- [ ] 3.4 Update consumers that currently branch on `live_now` to use `getEventStatus` instead: home map (`apps/mobile/app/(app)/index.tsx`), `apps/mobile/app/event/list.tsx` countdown chip, `apps/mobile/app/event/[id].tsx` title block.
- [ ] 3.5 Add two upcoming seeds in `mockSeeds.ts` (one NYC, one Ithaca) with `starts_at` ~25 min in the future.
- [ ] 3.6 Manually verify: upcoming seeds render the upcoming variant; switching `live_now` true on an upcoming event re-renders as live.

## 4. Bonfire radius overlay on map

- [ ] 4.1 New `apps/mobile/components/map/EventRadius.tsx` — translucent circle (`Animated.View`, `borderRadius: 999`, low opacity, ember tint when live / dusk tint when upcoming). Live events pulse on the `heatmapPulseMs` cadence; upcoming events render flat.
- [ ] 4.2 Compute the on-screen pixel diameter from a configurable metres radius using the same projection `MapStage` uses for pin placement. Default radius 80 m.
- [ ] 4.3 Extend `MapStage` with a `radiusOverlays` prop (`{id, lat, lng, radiusM, status}[]`) and render the overlays in a layer beneath pins so pin taps still win the gesture.
- [ ] 4.4 Emit one overlay per entry in `mapEvents` from `apps/mobile/app/(app)/index.tsx`.
- [ ] 4.5 Manually verify: overlays move with pan/zoom, sit centred on their pin, do not steal taps from the pin, and live vs upcoming look visibly different.

## 5. Map legend surface

- [ ] 5.1 New `apps/mobile/components/map/MapLegend.tsx` — bottom-sheet-style panel listing five rows: Live bonfire, Upcoming bonfire, You are here, Bonfire radius, More people. Each row composes the real swatch component (`EventPin`, `SelfIndicator`, `EventRadius`, `AvatarStack`) with a short description.
- [ ] 5.2 Add an info `IconButton` in the `AppHeader` trailing slot on the home map (`apps/mobile/app/(app)/index.tsx`) that opens the legend.
- [ ] 5.3 Sheet uses the same modal presentation conventions as `apps/mobile/app/event/list.tsx`.
- [ ] 5.4 Manually verify: legend opens from the header button, each swatch matches what's actually drawn on the map, dismiss returns the user to the map.

## 6. Spec validation

- [ ] 6.1 Read through `openspec/changes/add-event-click-workflow/specs/map-events/spec.md` against the running app; every requirement and scenario should be observably true. Update the spec (not the app) if a requirement turns out to be wrong; update the app if the spec is right and the app drifted.

# Bonfire

See the friends you already have, the moment they're out.

A real-time, circle-scoped presence app for iOS. This monorepo contains the mobile client, the shared types package, the design tokens package, and the Postgres schema.

## Status

| Milestone | What landed | What's stubbed |
|---|---|---|
| **M0** — Design system | Tokens (OKLCH→hex baked), nine base components, `/components-preview` route, font loading | — |
| **M1** — Schema | 9 SQL migrations, RLS policies, fan-out triggers, Realtime publication, 25-venue seed | Need to apply via `supabase db reset` against a real project |
| **M2** — Auth + onboarding | Welcome, phone, OTP with shake error, three-permission sheets, contact-match + circle build | OTP is mock; wire to `supabase.auth.signInWithOtp` once a project exists |
| **M3** — Network | Tabs (circles/friends/suggested), circle detail+edit, add-friend (phone/contacts/QR) | QR camera; phone search query |
| **M4** — Go Live | Modal with three IntentBadge-anchored intent cards, visible-to picker, haptics | Real `presence_events` insert; venue auto-detect via `snap_to_venue` RPC |
| **M5** — Home map | Skia map stage, breathing heatmap (`HeatmapPulse`), venue-grouped `AvatarStack`s, FAB | MapLibre swap — public interface of `<MapStage>` matches what MapLibre would expose |
| **M6** — Around | List archetypes (group / solo), time-filter chips | — |
| **M7** — Venue detail | Hero band, `BonfireScore` from deterministic formula, friends-here, live activity, Drop a pin / Walk over | OpenTable/Resy reservation widget |
| **M8** — Inbox | Five item kinds with distinct visual languages, day grouping, mark-all-read | Push delivery (Expo Push) |
| **M9** — Gather | Detail (WHO'S IN, WHERE w/ scores, RESERVATION, ACTIVITY), 3-step creation wizard | Reservation provider API |
| **M10** — Profile + settings | Self, friend, five-section settings tree | Photo upload |
| **M11** — Polish | Empty states across Home, Around, Inbox; pulse/spring tuning | — |

The app runs end-to-end on mock data when `EXPO_PUBLIC_SUPABASE_*` env vars are unset — every screen renders a believable cast (`apps/mobile/lib/mockSeeds.ts`).

## Run it

```bash
npm install
npm run start --workspace=apps/mobile
```

Scan the QR with Expo Go (iOS 15.1+). See `apps/mobile/QUICKSTART.md` for the WSL/Windows tunnel flow.

To wire a real backend, follow `supabase/README.md`.

## Structure

```
apps/mobile/                   Expo + Expo Router 6 client
  app/                          File-based routes
    (auth)/                     Welcome, phone, OTP
    (onboarding)/               Permissions, contacts
    (app)/                      Bottom-tab shell (Home, Around, Network, Inbox)
      network/                  Circle detail, add friend
      profile/                  Self, friend, settings
    go-live.tsx                 Modal
    venue/[id].tsx              Modal
    gather/                     Detail + creation
    components-preview.tsx      Visual sandbox for the design system
  components/
    ui/                         Avatar, Chip, Card, CTAButton, ...
    map/                        HeatmapPulse (Skia), MapStage
  lib/
    supabase.ts                 Client + env detection
    session.tsx                 Auth state provider
    data.ts                     Hooks that fall back to mocks when offline
    mockSeeds.ts                Seed cast for offline development
    bonfireScore.ts             Score formula per spec §7.5
    mapProjection.ts            Lat/lng → screen for the Skia map
    relTime.ts                  "2 min ago" formatter
    useLoadFonts.ts             Source Serif 4 + Onest + Geist Mono

packages/
  shared/                       Domain types matching the Postgres schema
  ui-tokens/                    OKLCH-baked color palettes, spacing, type, motion

supabase/
  migrations/                   9 SQL files; apply in numeric order
  seed/venues.sql               25 Ithaca + NYC venues

docs/superpowers/
  specs/                        Design specs
  plans/                        Implementation plans
```

## Design references

- `.impeccable.md` — design context (tone, palette, typography)
- `docs/superpowers/specs/2026-05-16-bonfire-mvp-design.md` — full MVP spec
- `references/` — original deck mockups (8 screens)

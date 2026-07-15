# apps/mobile — Bonfire v2

A gated neighborhood group presence app (iOS + web PWA). Real-time fire, fog-of-war map, circle management, and spontaneous gathering. Canonical spec: `docs/superpowers/specs/2026-06-09-bonfire-mvp-spec-v2.1.md`.

## Route structure (Expo Router 6, file-based)

```
(auth)/           Welcome, phone OTP, verification
(onboarding)/     Permissions, contacts
(app)/            Tab shell
  (app)/          Home (fire + map), Around (venue list), Network (circles/friends), Inbox
  network/        Circle detail, add friend
  profile/        Self, friend, settings
go-live.tsx       Check-in modal — the one required action
venue/[id].tsx    Venue detail
gather/           Event detail + creation wizard
components-preview.tsx   Design system visual sandbox
```

## Key lib files

| File | Purpose |
|---|---|
| `lib/data.ts` | Data hooks; falls back to `mockSeeds.ts` when Supabase env vars are unset |
| `lib/mockSeeds.ts` | 503-line offline cast (avatars, venues, presence, gathers) |
| `lib/bonfireScore.ts` | Deterministic heat score formula (§7.5 of v2.1 spec) |
| `lib/mapProjection.ts` | Lat/lng → Skia canvas coordinates |
| `lib/supabase.ts` | Client + env detection |
| `lib/session.tsx` | Auth state provider |
| `components/map/MapStage` | Unified map interface: `@maplibre/maplibre-react-native` on native, `maplibre-gl` on web |
| `components/map/HeatmapPulse` | Skia breathing heatmap |

## Stack

Expo 54 · Expo Router 6 · React Native 0.81 + react-native-web · Reanimated 4 · NativeWind 4 · `@shopify/react-native-skia` · MapLibre · Supabase + PostGIS · Haptics · Geist Mono / Onest / Source Serif 4

## Milestone state (as of June 2026)

All screens M0–M11 are prototyped and rendered. Still stubbed:

| Feature | Stub note |
|---|---|
| Phone OTP | Paused — re-enable by routing welcome → `/(auth)/phone` when Twilio ready |
| Real presence insert | `snap_to_venue` RPC call not wired in go-live modal |
| Push delivery | Expo Push token registered but delivery not wired |
| QR camera | Add-friend QR scan flow |
| Reservation widget | OpenTable/Resy provider API |
| Photo upload | Profile photo post-capture |

## Platform notes

- **Web PWA first.** Safari Add to Home Screen is a hard onboarding step — iOS web push requires it.
- **Auth:** 6-digit email OTP. No magic links — a link tap opens Safari, not the installed PWA, and strands the session.
- **No Android polish in MVP** — code is Android-compatible but not Android-tested.
- App runs fully on mock data when `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are unset.

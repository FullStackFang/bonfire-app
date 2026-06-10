# v2 Pivot Plan — kill / keep / repurpose

**Date:** June 9, 2026
**Spec:** `docs/superpowers/specs/2026-06-09-bonfire-mvp-spec-v2.1.md`

## Context

The repo currently implements Bonfire v1: a friend-graph presence app ("see the friends you already have, the moment they're out") — circles, contact matching, go-live intents, gathers, inbox, venue Bonfire Scores, Cornell/NYC college wedge. v2 is a different product sharing the name, the design system, and the warmth: gated neighborhood groups, a weekly ritual, and a mortal collective fire.

The pivot is cheaper than it looks: the backend was never applied to a live project, push was stubbed, and the app runs on mock data — so the cost is UI surface and schema files, not data migration. The design system (M0) survives wholesale.

---

## Phase 0 — Docs (done in this change)

- [x] Spec v2.1 written (`docs/superpowers/specs/2026-06-09-bonfire-mvp-spec-v2.1.md`)
- [x] `PRODUCT.md` rewritten to v2 doctrine (fire is the product; check-in is the one required action; map is the memory)
- [x] `DESIGN.md` doctrine edits (hero, color semantics, avatars photo-first, haptics, examples) — component library untouched
- [x] `README.md` pivot banner + reference fixes
- [x] Old spec bannered as superseded
- [ ] Close out `openspec/changes/add-event-click-workflow` — the feature (map event creation) is on v2's explicitly-not-building list. Archive the proposal; do not implement.

## Phase 1 — Code prune & repurpose

### Keep as-is

| Asset | Why |
|---|---|
| `components/ui/*` (Avatar, Chip, Card, CTAButton, ChunkyPressable, IconButton, SegmentedControl, AppHeader, EmptyState…) | M0 design system — finished, on-brand |
| `packages/ui-tokens`, `packages/shared` | Tokens unchanged; types will be replaced but the package stays |
| `components/map/MapStage.tsx`, `HeatmapPulse.tsx`, `PulsingMapPin.tsx` | Map shell + glow language → fog-of-war base. Needs `MapStage.web.tsx` fork (`maplibre-gl`) and a `dark_all` tile style |
| `lib/supabase.ts`, `lib/session.tsx`, `lib/useLoadFonts.ts`, `lib/relTime.ts`, `lib/geo.ts`, `lib/useUserLocation.ts`, `lib/mapProjection.ts` | Infrastructure, product-agnostic |
| `app/components-preview.tsx` | Design sandbox |

### Repurpose

| v1 asset | v2 role |
|---|---|
| `app/event/new.tsx` long-press flow + kindling animation | Pulse creation (pin + note + 90-min expiry) and ember drop — the interaction is shape-identical; the *feature* (event creation) is killed |
| `components/map/EventPin.tsx`, `EventRadius.tsx` | Pulse pin + pulse radius |
| `components/map/FriendFlamePin.tsx` | Checked-in member pins at a live gathering |
| `components/map/SelfIndicator.tsx` (flame work) | Seed material for the fire visualization (v1 plain fire, week 4) |
| `components/map/LayersControl.tsx` | My Map / Group Map toggle |
| `app/legend.tsx` | Map legend: lit territory / embers / pulses |
| `app/go-live.tsx` modal shell | Check-in modal (one tap, venue suggest) |
| `app/(auth)/phone.tsx` + `verify.tsx` (kept in tree) | Email-OTP screens, nearly verbatim (`signInWithOtp` + OTP email template) |
| `app/venue/[id].tsx` | v2 venue detail — keep hero band + friends-here bones; drop BonfireScore and reservation widget; add *Pulse here* / *Drop ember* |
| `lib/mockSeeds.ts`, `lib/mockEventStore.ts`, `lib/mockPresenceStore.ts` | Rewrite as one v2 cast: 1 group, 25 members, dark map, a few lit venues + embers |

### Delete

- `app/(app)/network/*` (circles, add-friend), `app/(onboarding)/contacts.tsx` — no friend graph
- `app/(app)/around.tsx`, `app/(app)/inbox.tsx` — no feed surfaces; fire-driven notifications replace the inbox
- `app/gather/*`, `app/event/list.tsx`, `app/event/[id].tsx` (after salvaging the creation interaction) — no event UI
- `app/(app)/profile/[id].tsx` — no profiles; faces + ask-me-about live on the Group screen. Trim `profile/settings.tsx` to notifications + leave-group
- `components/map/BonfiresNearby.tsx`, `CircleFilterChip.tsx` — v1 concepts
- `lib/bonfireScore.ts` — no venue scores; territory is a record, not a rating
- Root: `filter-previews.html`, `people-pin-previews.html` — v1 explorations
- Tab shell: 4 tabs (Home/Around/Network/Inbox) → **3 tabs (Fire / Map / Group)**

## Phase 2 — Schema reset

The 11 v1 migrations were never applied to a live project. Replace rather than migrate:

- **Keep bones:** `extensions` (PostGIS), `users` (add required photo, ask-me-about; email-OTP auth), `venues` (add `osm_id`; pre-pull seed replaces the 25-venue hand seed)
- **Drop:** `friendships`, `circles`, `presence_events`, `gathers`, `inbox`, `fanout_triggers`, v1 `realtime` publication
- **New tables:** `groups`, `memberships`, `vouches`, `anchors`, `anchor_instances`, `rsvps`, `checkins`, `embers`, `lit_territory`, `pulses`, `pulse_joins` — fields, FKs, uniqueness, and RLS invariants per spec §Data model
- **Functions:** heat recompute on check-in insert; daily edge function (decay, state evaluation + transition notifications, ember expiry, anchor-instance generation, torch T-48h fallback)
- **Seed:** `scripts/pull-venues` — one-time Overpass pull of every POI in the launch neighborhood
- **`supabase/metrics.sql`** — north star + RSVP-in rate, show rate, repeat rate, capture rate, committed day one
- **RLS tests:** solo check-ins owner-only is the privacy promise; test it, don't just write it

## Phase 3 — Build

Follow the week-by-week table in spec §Build sequence. The three gates:

1. **Gate 1 resolved June 10, 2026: GO.** Web push verified end-to-end on an installed iOS PWA from the Expo web export — subscribe via `web.push.apple.com`, VAPID-signed sends accepted (HTTP 201), notification delivered on the founder's device. Phase 1 ships Expo-universal; `apps/web` is demoted (delete when convenient). Spike artifacts kept as the real notification skeleton: `apps/mobile/public/sw.js`, `manifest.json`, `app/push-spike.tsx`, `scripts/send-push.mjs`, Vercel project `bonfire-pwa-spike`. Bonus finding: v1 MapStage hosts MapLibre GL JS in a `react-native-webview` (no web impl) — the v2 map must use the real platform fork (`maplibre-react-native` native / `maplibre-gl` web), confirming the prune.
2. ~~June 15: Cornell decision~~ — **dropped June 10**; full focus on the WFH neighborhood wedge.
3. **Week of Sep 7: Group #1 onboards.** Soft alpha (founder's friends) runs from week 4 through August as the tuning cohort. No mortality clock starts in August.

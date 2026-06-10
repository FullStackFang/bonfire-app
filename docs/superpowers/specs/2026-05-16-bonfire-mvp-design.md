# Bonfire MVP — Design Spec

> **Superseded (June 9, 2026):** this is the v1 spec — the friend-graph presence app. Canonical spec: `docs/superpowers/specs/2026-06-09-bonfire-mvp-spec-v2.1.md`; migration plan: `docs/superpowers/plans/2026-06-09-v2-pivot-plan.md`.

**Date:** 2026-05-16
**Status:** Superseded by v2.1
**Scope:** iOS-first MVP. Eight core screens, plus the supporting screens, flows, and empty states that are launch-critical but not visualized in the reference deck.
**Source documents:** `.impeccable.md` (design context), `references/bonfire_mvp_ios_screens.html` (mock deck), the eight reference PNGs in `references/`.

---

## 1. Product Loop

Bonfire's MVP enforces a four-stage loop. Every screen serves exactly one stage.

| Stage | Screens | The user's question |
|---|---|---|
| **See** | Home/Map (2), Around (4) | Who is out near me? |
| **Signal** | Go Live (3) | I am out — show me to my circles |
| **Join** | Venue Detail (5) | Should I go there, and how do I commit? |
| **Coordinate** | Gather (6), Inbox (8) | We're forming something — are you in? |
| **Foundation** | Onboarding (1), Network (7) | Who counts as a friend, in which context? |

The single required user action is **Go Live**. Everything else — venue detection, heatmap warming, social proof, gather invites — is reactive surface area. The spec preserves this asymmetry.

---

## 2. Tech Stack Decisions

Locked for MVP. Each choice has a one-line justification.

| Concern | Choice | Why |
|---|---|---|
| App framework | Expo SDK 54 + Expo Router 6 | Already in repo; file-based routing, native modules included |
| UI | React Native 0.81 + NativeWind 4 | Already in repo; Tailwind ergonomics on RN |
| Map | `@maplibre/maplibre-react-native` (v10) | Free vector tiles, custom style JSON (required for the warm aesthetic), real shape/heatmap layers |
| Map tiles | Self-host via Protomaps (`pmtiles`) on Supabase Storage or MapTiler trial | Avoids Mapbox's default styling and pricing; lets us ship a warm custom style |
| Auth | Supabase Auth (phone OTP) | Phone is the identity for contact matching anyway |
| DB | Supabase Postgres (with PostGIS extension) | Geospatial queries for "venues within X meters" |
| Realtime | Supabase Realtime (Postgres changes + broadcast) | Subscribe to `presence_events` and `gathers` channels |
| Push | Expo Push (APNs under the hood) | Easiest path on Expo managed workflow |
| Reservation lookup | OpenTable affiliate API (read-only availability) + Resy `discovery` endpoint | Both have public/affiliate access; party-size pre-fill is the only write we attempt |
| Phone contacts | `expo-contacts` | iOS-native, hashed-then-matched (see §6) |
| Geofencing | `expo-location` `startGeofencingAsync` + venue polygon checks | Native iOS geofence regions cap at 20; we layer in foreground polygon checks for the rest |
| Animation | Reanimated 3 + Skia (`@shopify/react-native-skia`) | Skia is required for the heatmap shader; Reanimated for everything else |
| Haptics | `expo-haptics` | Already installed |
| Typography | `expo-font` loading Sentient + Switzer + Fragment Mono from FontShare | Distinctive, free, not in the AI-default list |

**Out of scope for MVP:** Android polish, web companion, group chat inside gathers, photo posts, public events, monetization.

---

## 3. Information Architecture

### 3.1 Route tree (Expo Router)

```
app/
  _layout.tsx                       // root: fonts, providers, theme
  (auth)/
    _layout.tsx                     // unauthenticated stack
    welcome.tsx                     // logo + "Continue with phone"
    phone.tsx                       // phone input
    verify.tsx                      // OTP
  (onboarding)/
    _layout.tsx                     // post-signup stack
    permissions.tsx                 // location + contacts + notifications sheets
    contacts.tsx                    // SCREEN 1 — build your bonfire
    circles.tsx                     // first-circle creation
  (app)/
    _layout.tsx                     // bottom tabs
    index.tsx                       // SCREEN 2 — Home / Map
    around.tsx                      // SCREEN 4 — Around (list)
    network/
      index.tsx                     // SCREEN 7 — Network
      circle/[id].tsx               // circle detail + edit
      add-friend.tsx                // search / QR / phone-match
    inbox.tsx                       // SCREEN 8 — Inbox
    venue/[id].tsx                  // SCREEN 5 — Venue detail (modal pres.)
    gather/
      [id].tsx                      // SCREEN 6 — Gather detail
      new.tsx                       // Gather creation flow
    go-live.tsx                     // SCREEN 3 — Go Live (modal pres.)
    profile/
      index.tsx                     // self profile
      settings.tsx                  // settings tree
      [id].tsx                      // friend profile
    geofence-confirm.tsx            // "We think you're at X — confirm?" sheet
```

### 3.2 Bottom tabs

Exactly four: **Home · Around · Network · Inbox**. Profile lives in the top-left of Home (avatar tap). Go Live is the FAB on Home and Around, not a tab — committing to it as a fifth tab would dilute its meaning.

---

## 4. Design System

Refer to `.impeccable.md` for tone, fonts, and color justifications. This section codifies them as tokens.

### 4.1 Color tokens (`packages/ui-tokens/src/colors.ts`)

```ts
export const light = {
  ember:        'oklch(66% 0.19 30)',
  emberDeep:    'oklch(48% 0.16 28)',
  emberGlow:    'oklch(78% 0.12 35)',
  spark:        'oklch(68% 0.15 145)',  // available/live green
  dusk:         'oklch(70% 0.14 55)',   // out today
  night:        'oklch(28% 0.04 260)',  // out tonight, dark surfaces

  coal:         'oklch(22% 0.02 30)',   // primary text
  smoke:        'oklch(52% 0.015 30)',  // secondary text
  ash:          'oklch(88% 0.008 30)',  // dividers
  hearth:       'oklch(100% 0 0)',      // card surface
  cream:        'oklch(98% 0.012 60)',  // screen surface
} as const;

export const night = {
  ember:        'oklch(72% 0.19 32)',   // slightly brighter on dark
  emberDeep:    'oklch(58% 0.18 30)',
  emberGlow:    'oklch(60% 0.14 35)',
  spark:        'oklch(74% 0.16 145)',
  dusk:         'oklch(76% 0.14 55)',
  night:        'oklch(16% 0.03 260)',

  coal:         'oklch(96% 0.01 60)',   // inverted
  smoke:        'oklch(68% 0.02 30)',
  ash:          'oklch(28% 0.02 30)',
  hearth:       'oklch(22% 0.025 260)',
  cream:        'oklch(14% 0.02 260)',
} as const;
```

Night mode auto-activates when (a) system is in dark mode AND time is between 19:00 and 06:00 local, OR (b) the user has selected "Out tonight". It is not a manual toggle — see §7.

### 4.2 Spacing scale (`packages/ui-tokens/src/spacing.ts`)

```ts
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96 };
```

Used semantically. No raw pixel values in component code.

### 4.3 Type scale

```
display-xl   34 / 38   Sentient Regular Italic   screen titles ("Build your bonfire")
display-lg   28 / 32   Sentient Regular          numeric callouts (Bonfire score)
title        22 / 28   Sentient Medium           section heads
body-lg      17 / 24   Switzer Regular           list-row primary, paragraphs
body         15 / 22   Switzer Regular           default
body-sm      13 / 18   Switzer Medium            chips, captions
mono-sm      12 / 16   Fragment Mono Regular     timestamps, coordinates
overline     11 / 14   Switzer Medium uppercase  section labels ("WHO'S IN")
```

iOS Dynamic Type: all sizes scale via `useTypeScale()` hook backed by `PixelRatio.getFontScale()`, capped at 1.4× to preserve layout.

### 4.4 Components (`apps/mobile/components/`)

Build these first; every screen composes from them.

| Component | Purpose |
|---|---|
| `Avatar` | Letter-pair on a tinted oklch circle. Sizes `xs/sm/md/lg`. Has `live` prop that adds breathing ember halo via Skia. |
| `AvatarStack` | Overlapping avatars with negative margin and white ring. Renders `+N` overflow chip. |
| `Chip` | Pill button. Variants: `solid` (ember), `outline`, `ghost`. Sizes `sm/md`. |
| `Card` | Rounded-2xl hearth surface with optional `interactive` press-spring. **No left-border accent — see `.impeccable.md` ban.** |
| `CTAButton` | Full-width ember pill, 56px tall, with optional flame icon. Haptic on press. |
| `BonfireScore` | The number-in-pill. Sentient display-lg, ember fill, animated digit count on change. |
| `LiveDot` | 6px spark-colored circle with a 2px outer ring. Pulses if `pulse` prop set. |
| `HeatmapPulse` | Skia component: radial gradient pulsing 3.2s ember falloff. Used for live circles on map and for the heatmap layer. |
| `IntentBadge` | Pill carrying intent state with its icon and color (Available/Today/Tonight). |
| `BottomSheet` | Wraps `@gorhom/bottom-sheet`. House preset: spring `mass:1 damping:22 stiffness:220`. |
| `MapAvatarPin` | MapLibre symbol layer + overlay React component for tappable avatars. Handles cluster expansion. |
| `EmptyState` | Illustration + headline + one CTA. Required prop: `nextGesture` (string) — the empty state must always teach. |

### 4.5 Map style

Custom MapLibre style JSON (`apps/mobile/assets/map/bonfire-day.json` and `bonfire-night.json`). Built on top of OpenStreetMap data via Protomaps.

- **Land**: cream `oklch(98% 0.012 60)` (day) / night-shifted (night).
- **Water**: a desaturated dusk blue, never the default cyan.
- **Roads**: ash, single weight at zoom <14, two-weight (arterial + minor) at zoom ≥14. No labels until zoom ≥15 to keep the map quiet under the avatars.
- **Buildings**: 4% darker than land, no 3D extrusion.
- **POIs**: hidden by default. Bonfire-relevant categories (bars, restaurants, cafes) shown as 4px coal dots at zoom ≥15.
- **Labels**: Switzer Medium, small, smoke. Place labels only.

No satellite, no terrain, no traffic. The map is a stage, not the show.

### 4.6 Motion library

House spring: `{ mass: 1, damping: 22, stiffness: 220 }`.
Heatmap pulse: 3.2s sine, no easing variation.
Reduce Motion: pulses become a single static 30% glow; springs become 200ms ease-out.

---

## 5. Data Model

PostgreSQL schema. Live in `supabase/migrations/` once created. Names favor clarity over brevity.

### 5.1 Tables

```sql
-- Users (mirrors auth.users)
create table users (
  id uuid primary key references auth.users on delete cascade,
  phone_hash text unique not null,   -- SHA-256 of E.164 phone, for contact matching
  display_name text not null,
  letter_pair text not null,         -- 2-char avatar label
  avatar_color text not null,        -- oklch string
  created_at timestamptz default now()
);

-- Friendships are bidirectional but stored as a single row (lower-uuid, higher-uuid)
create table friendships (
  user_a uuid references users not null,
  user_b uuid references users not null,
  established_via text not null,     -- 'contact_match' | 'qr' | 'phone_search'
  created_at timestamptz default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

-- Circles are owned by one user, contain friends of theirs.
create table circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users not null,
  name text not null,
  accent_color text not null,        -- oklch, used as the circle's tag color
  created_at timestamptz default now()
);

create table circle_members (
  circle_id uuid references circles on delete cascade,
  user_id uuid references users not null,
  added_at timestamptz default now(),
  primary key (circle_id, user_id)
);

-- Venues (snap-to-place targets). Seeded from Foursquare/OSM POIs in MVP regions.
create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,            -- 'bar' | 'restaurant' | 'cafe' | 'other'
  neighborhood text,
  location geography(point, 4326) not null,
  polygon geography(polygon, 4326),  -- venue footprint when known
  opentable_rid text,                -- OpenTable restaurant id, nullable
  resy_id text,                      -- Resy id, nullable
  created_at timestamptz default now()
);
create index on venues using gist (location);

-- The core of the product.
create table presence_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users not null,
  intent text not null check (intent in ('available_now','out_today','out_tonight')),
  visible_to_circle_ids uuid[] not null,
  venue_id uuid references venues,
  raw_location geography(point, 4326),  -- captured but only used to derive venue_id
  started_at timestamptz default now(),
  expires_at timestamptz not null,
  ended_at timestamptz                  -- null while active
);
create index on presence_events (user_id, expires_at);
create index on presence_events using gist (raw_location);

-- Gathers (the asynchronous coordination unit).
create table gathers (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references users not null,
  title text not null,
  starts_at timestamptz,             -- nullable; "forming now" if null
  primary_venue_id uuid references venues,
  candidate_venue_ids uuid[] not null default '{}',
  invited_circle_ids uuid[] not null,
  party_size_target int,
  reservation_provider text,         -- 'opentable' | 'resy' | null
  reservation_url text,
  created_at timestamptz default now(),
  ended_at timestamptz
);

create table gather_responses (
  gather_id uuid references gathers on delete cascade,
  user_id uuid references users not null,
  response text not null check (response in ('in','maybe','out')),
  responded_at timestamptz default now(),
  primary key (gather_id, user_id)
);

-- Inbox items are denormalized for fan-out speed.
create table inbox_items (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references users not null,
  kind text not null check (kind in
    ('friend_live','gather_invite','heatmap_hot','friend_arrived','milestone')),
  payload jsonb not null,
  source_event_id uuid,              -- presence_event_id or gather_id, by kind
  created_at timestamptz default now(),
  read_at timestamptz
);
create index on inbox_items (recipient_id, created_at desc);
```

### 5.2 Realtime channels

| Channel | Subscribed by | Carries |
|---|---|---|
| `presence:circle:{circle_id}` | Anyone in that circle | INSERT/UPDATE/DELETE on `presence_events` filtered by `visible_to_circle_ids` overlap |
| `gather:{gather_id}` | Anyone invited or responded | Changes on `gather_responses` and the gather row itself |
| `inbox:{user_id}` | The user | Changes on `inbox_items` for that user |
| `venue:{venue_id}` | Anyone viewing the venue detail | Aggregated "friends here" count + activity feed |

### 5.3 Heatmap derivation

The heatmap is **not stored**. It is computed client-side from the currently-subscribed `presence_events`:

1. Bucket active events into ~80m hex cells (h3 resolution 9).
2. Cell heat = number of friends live in that cell, weighted by recency (events <10 min: ×1.0, 10–30 min: ×0.7, 30+ min: ×0.4).
3. Render as a Skia radial gradient per cell, ember-tinted, alpha proportional to heat. Cells fade in/out over the house spring.

This avoids a backend job and keeps the map's pulse honest to current state.

### 5.4 Venue auto-detection

When a user goes live, we capture their location once (high accuracy, 30s timeout). Snap-to-venue logic:

1. Query `venues` within 60m of the point (PostGIS).
2. If exactly one match → set `venue_id`, no prompt.
3. If 2-4 matches → push the geofence-confirm sheet (§7.X).
4. If 0 matches or 5+ → leave `venue_id` null, show "Near you" instead of a venue name.

After going live, we also start an `expo-location` background task that re-snaps every 5 minutes while the event is active.

---

## 6. Privacy & Trust Boundaries

These are not engineering footnotes — they are the product. Get them wrong and the product is dead.

- **Contact matching is hashed.** On contact import, we SHA-256 the E.164 phone client-side and send hashes only. The server matches against `users.phone_hash`. Raw phone numbers never leave the device.
- **Presence is circle-scoped.** Every `presence_events` row carries `visible_to_circle_ids`. The Realtime channel filter enforces this — no client gets events they shouldn't see. RLS policies on Postgres mirror the filter as defense-in-depth.
- **Location is presence-scoped.** We only capture location *while a presence event is active*. No background "always-on" tracking outside an active event. When an event expires, the location task stops.
- **Auto-detected venues are confirmable.** Any time the snap is uncertain (2-4 candidates), the user confirms before the venue is broadcast. The detection itself is not visible to friends until confirmed.
- **One-tap unshare.** Tapping the ember FAB while live opens the Go Live sheet in "stop" mode — single tap ends the event and removes it from all subscribers within the next Realtime tick (<2s).

---

## 7. Screen Specs

Each screen is specified with: purpose, the one thing it must nail, key components, states (including empty and error), data dependencies, motion details. Screens follow the order the user encounters them, not the build order (build order is §8).

### 7.0 Auth (welcome → phone → verify)

**Not in the deck but launch-critical.**

- Welcome: full-bleed warm gradient (cream → ember-tinted cream), the wordmark in Sentient Italic centered, single ember CTA "Continue with phone". Underneath, microcopy: "We use your number to find your real friends. We never post anything."
- Phone: country-code selector (default detected) + national number. As the user types, render their number in Fragment Mono at display-lg size — the input *is* the typography.
- Verify: 6-digit OTP, each digit in its own square cell. Auto-submit on completion. On error, the cells shake with the house spring (negative initial velocity).

### 7.1 Onboarding — Build Your Bonfire (Screen 1)

**Purpose:** Establish the trust boundary before the first map view. The user cannot reach Home without at least one circle containing ≥1 friend.

**The one thing:** Make adding people feel like building a fire, not filling out a form. The toggles are the kindling.

**Flow:**
1. Permission sheets (location-always, contacts, notifications) — see §7.X.
2. After contacts permission granted, we hash-match against existing users and show three buckets, in this row order:
   - **Matched friends already on Bonfire** (top, toggles default on)
   - **Suggested via mutuals** (4+ shared circles among matched friends — toggle default off)
   - **Invitable contacts** (toggle becomes "Invite via SMS")
3. Below the list: circle chips. Tap "New circle" to create one inline — naming pill, an accent-color picker (six oklch swatches), then drag-or-tap members in.
4. CTA "Continue" enabled when ≥1 friend toggled AND ≥1 circle exists.

**Empty state (no contact matches):** Headline "No friends yet — that's fine." Sub: "Add one by phone number or QR. You can always do this later." Two ghost buttons: "Add by phone", "Show my QR". CTA remains "Continue" but is now a low-key outline button.

**Components:** `ContactRow` (Avatar + name + circle-count + toggle), `CircleChip`, `NewCircleSheet`.

**Motion:** When a contact is toggled on, their avatar bursts a small Skia spark particle effect (8 particles, 600ms, no replay until next toggle). This is the one delight moment that earns its keep — every other animation in the app should feel restrained next to it.

### 7.2 Home — Live Map (Screen 2)

**Purpose:** The product. You open Bonfire, you see this.

**The one thing:** The map must feel warm and alive within 200ms of opening. No spinners on the map itself — render the style instantly, then fade in pins.

**Layout (top to bottom):**
- Status bar (system)
- Search pill (Switzer body, ash bg, search icon left, flame icon right) — tappable to search; the flame on the right is a shortcut to Go Live
- Filter chip row: `People` (default solid ember), `Events`, `Available now ▾`
- Map (fills remaining space)
- Ember FAB bottom-right (52px, 3px hearth ring, flame icon)
- Bottom tabs

**Map layers, bottom to top:**
1. Base style (custom MapLibre)
2. Heatmap layer (Skia overlay clipped to map viewport)
3. Live activity bubbles (white pills like "Out for drinks" — anchored to the venue centroid, offset above)
4. Friend pins (Avatar or AvatarStack — clusters when 2+ within ~40px screen-space)
5. User's own location dot (spark-colored, slightly larger ring than friends)

**Pin behavior:** Tap an avatar → bottom sheet with a mini venue card (or a "Drop me a line" sheet if the friend is not at a known venue). Tap an activity bubble → full venue detail.

**Motion details:**
- On mount: map fades in over 300ms; heatmap layer fades in over 600ms with sine ease; pins drop in with house spring, staggered by 30ms (max 8 stagger slots, additional pins all in slot 8).
- Live pin halo: continuous breathing pulse via Skia (3.2s).
- Map pan: native MapLibre, no overrides.

**Empty state (no friends live):** The heatmap layer doesn't render. Instead, a centered ember card floats over the map: "No one out yet. Be the first." — single CTA "Go live". This is the highest-churn moment in the app; treat it as a designed screen, not an empty state.

**Data:** Subscribes to `presence:circle:{id}` for every circle the user is in, deduplicating events per user (one user appearing in two circles renders once).

### 7.3 Go Live (Screen 3)

**Purpose:** The single required user action.

**The one thing:** Three intent states presented as three lit candles — not three radio buttons. The choice should feel like committing to a posture, not picking a setting.

**Presentation:** Modal sheet from bottom, 92% screen height, drag handle at top.

**Layout:**
- Header: "Go live" Sentient display, close X on the right.
- One-line sub: "Broadcast availability to your circles. No event, no plan needed."
- Three intent cards stacked vertically, each ~96px tall:
  - **Available now** (spark accent) — "Active for the next 60 minutes. Auto-detects your venue."
  - **Out today** (dusk accent) — "Floating around until evening. Shows up on the map all day."
  - **Out tonight** (night accent) — "Active for the night-time loop, 6pm onward."
- "Visible to" picker — tappable row listing selected circles ("Cornell crew, NYC"). Tap → multi-select sheet with all circles.
- CTA: "Go live 🔥" — ember, 56px.

**Design choice — no left-border accent.** The mock uses a `border-left: 3px solid`, which is banned by `.impeccable.md`. Replacement: each intent card carries a 32px circular badge in the top-left containing the intent's icon and accent color. The badge is the visual anchor. Cards remain a flat hearth surface with a 1px ash border that warms to the intent color when selected.

**Selected state:** Tapping a card sets it as the only selected intent. Selected card scales 1.02 via spring, border warms from ash to intent color over 200ms, ember dot fades in next to the intent name. Other cards dim to 0.6 opacity.

**Commit:** "Go live" press triggers haptic `success`, sheet dismisses with the house spring, and a 1.2s confetti-of-embers Skia animation plays over the map (12 ember particles rising from the FAB location). The FAB icon switches from flame-outline to flame-filled with a subtle pulse halo. From this point on, tapping the FAB opens Go Live in "you are live — end?" mode.

**Stop mode:** Same sheet but the three intent cards become one card showing current state, expiry countdown in Fragment Mono ("expires in 47:12"), and a coal-text button "End now".

### 7.4 Around (Screen 4)

**Purpose:** Accessibility fallback for the map, and the secondary discovery surface for users who don't read maps naturally. Same data, different shape.

**The one thing:** Cards feel like a magazine spread, not a feed. Each card has its own visual rhythm.

**Layout:**
- Header: "Around you" Sentient title-xl, two icon buttons on the right (Map view / List view — list is active).
- Time-filter chips: `Now` (default), `Today`, `Tonight`.
- Card list. Three card archetypes, mixed in chronological order:
  1. **Group card** — multiple avatars, headline "Sarah, Maya +2", subline "at Maxie's · 2 min ago", activity strip (`Out for drinks · Cornell crew`), and a "Join them" CTA.
  2. **Solo card** — single avatar, headline "Josh Pizzaro", subline with venue, activity strip. No CTA — tapping the card goes to venue or profile.
  3. **Forming-gather card** — avatar pair, headline "Lydia, Kim", subline "Forming a gather · tonight", body "Dinner downtown — 3 in, looking for more", flame icon on the right. Tap → Gather screen.

**Visual rhythm:** Card padding alternates between tight (12px) and generous (20px) based on archetype — group cards get more space because they hold more content. Activity strips use intent-colored tinted backgrounds (ember-tint for "out for drinks", dusk-tint for "working remotely", etc.) — these are the only non-hearth surfaces inside cards.

**Empty state:** "Quiet out there. Be the first." Below: ghost button "Go live" + a single ghosted card example showing what a friend's presence would look like — teach the interface by showing a fake future.

### 7.5 Venue Detail (Screen 5)

**Purpose:** Destination from any tap. The decision point.

**The one thing:** The Bonfire score is the second-most-important pixel after the friend count. It is a real typographic event, not a chip.

**Layout:**
- Hero band (140px): Skia gradient + a slow-parallax Skia illustration of the venue archetype (bar/restaurant/cafe — three archetypes for MVP, computed from `venues.category`). Back/share/bookmark buttons float on top.
- Header row: Venue name (Sentient title), category + neighborhood + distance (smoke body-sm). On the right, the **Bonfire score block** — Sentient display-lg numeric on ember-tinted card, "BONFIRE" overline below. Score is a 0-100 derived metric (see §5.x).
- **Friends-here card**: spark dot, "5 friends here now", AvatarStack below. Tap stack → small modal of names.
- **Live activity feed**: 4-5 most recent events at this venue, formatted `Xmin ago | message`. Activities included: arrivals, go-live events, heatmap-warming events.
- Bottom CTAs (sticky above tab bar):
  - **Drop a pin** (outline, ember text) — broadcasts "interested" without going live yet; appears as a small ember dot on this venue on friends' maps.
  - **Walk over** (solid ember, slightly wider) — opens system maps with walking directions and auto-extends your presence event by 30 minutes.

**Bonfire score formula (MVP, deterministic):** `score = round(40 + 8 * friends_here + 3 * arrivals_last_hour + 2 * heatmap_neighbors - 0.3 * minutes_since_peak)`. Clamped 0-99. Cached per venue, refreshed every 60s. The score is a UI artifact — never persisted, computed on read.

**Empty states:**
- 0 friends here, has activity within 2 hours: show the activity feed as the hero content, "No friends here right now, but the bonfire's still warm."
- 0 friends, 0 activity: skip the friends card entirely; just show the venue card. CTAs still work — dropping a pin from a cold venue is how cold venues warm up.

### 7.6 Gather (Screen 6)

**Purpose:** Replace the WhatsApp pattern. Social proof (who's in) is the entire mechanic.

**The one thing:** "Who's in" is the top card and the biggest visual element. The mechanic is the headline; reservation logistics are subordinate.

**Layout:**
- Top bar: back arrow, title ("Dinner downtown"), subtitle ("Tonight · forming now"), overflow menu.
- **WHO'S IN card** (hearth, 14px corner radius): overline "WHO'S IN", confirmed count chip on the right (`4 confirmed` in spark), AvatarStack of confirmed users below, then "+ 2 maybe" in smoke. This is the largest card.
- **WHERE card**: overline "WHERE", three venue chips horizontally — selected one has ember border + ember-tinted Bonfire score, others are flat with their score. Tap to switch primary venue (host only) or vote (member).
- **RESERVATION strip**: only renders if any `WHERE` candidate has an `opentable_rid` or `resy_id`. Calendar-check icon, "Table for X · time", "Available on OpenTable", green "Book" button. Party size pre-populated from confirmed count.
- **ACTIVITY card**: small Fragment Mono timestamp feed of gather events (Sarah started, JP joined, venue switched, etc.).
- Bottom CTA: **I'm in** (solid ember, 56px) — when pressed, changes to **You're in** (outline) with secondary "I might be" / "I'm out" ghost links.

**Host vs member states:**
- Host sees venue chips as editable, can add candidates from a venue search sheet, can pick a primary.
- Member sees venue chips with a small upvote indicator under each — taps a chip to vote, host sees aggregated votes.

**Gather creation flow** (`gather/new`):
- Three-step bottom-sheet wizard, no separate screens:
  1. **Title + time** — title input (placeholder cycles through "Dinner downtown", "Drinks somewhere warm", etc.), time chips (`Tonight`, `Tomorrow`, `Friday`, custom).
  2. **Where** — venue picker with three modes: tap a venue from "venues near friends live now" suggestions, search, or "decide later" (skips primary venue).
  3. **Who** — circle multi-select (default: same as last go-live), then a final review with avatar previews.
- Commit → creates the gather, fan-outs invites to `inbox_items`, deep-links the host into the new gather screen.

### 7.7 Network (Screen 7)

**Purpose:** Manage the trust boundary. Without this, presence broadcasts are meaningless.

**The one thing:** Circles must feel like physical objects. The accent color is how you recognize them at a glance — repeated in their cards on this screen, in their chips on Go Live, and in their cards on Inbox.

**Layout:**
- Header: "Your network", add-friend icon (top-right).
- Tabs: `Circles` (default), `Friends`, `Suggested`.
- **Circles tab**: list of circle cards. Each card has:
  - Circle name (title) + people count (smoke)
  - AvatarStack of members + "+N" overflow
  - Right side: live state indicator (`● 4 live` in spark / `no one out` in smoke)
- **Replacement for the banned left-stripe accent:** each circle card has a 32px circle badge in the top-right corner filled with the circle's accent color, containing an emoji or initial. This *is* the circle's visual identity wherever it appears. The accent color also tints the AvatarStack ring (1px) and the live-state text. No left border at any width.
- "Create a new circle" tile at the bottom (dashed ash border, cream surface, plus icon).

**Friends tab**: alphabetical list. Each row: avatar, name, circles-they're-in chips, live indicator. Tap → friend profile.

**Suggested tab**: contact-match leftovers + mutual-friend suggestions. Each row has an "Add" outline button.

**Circle detail** (`network/circle/[id]`):
- Header: circle name (editable), accent color picker, people count.
- Member list with remove (host only) actions on swipe.
- Bottom actions: "Invite by link", "Leave circle" (destructive, ember-deep, requires confirmation).

**Add Friend** (`network/add-friend`): three tab options: `Phone` (search by number, hashed lookup), `Contacts` (manually re-trigger contact match if user added contacts after onboarding), `QR` (show your QR + scan camera).

### 7.8 Inbox (Screen 8)

**Purpose:** Catch-all for asynchronous signals.

**The one thing:** A unified type system across 5 different event kinds, where each kind has its own visual language but they all read as one stream.

**Layout:**
- Header: "Inbox", "Mark all read" link (ember, body-sm).
- Filter chips: `All`, `Gathers`, `Live`.
- Section header "TODAY" (overline), then "YESTERDAY", "THIS WEEK", etc.
- Notification rows. Five kinds:
  1. **gather_invite** — ember-tinted icon circle with flame, body text "Sarah started a gather: Dinner downtown", timestamp + confirmed count, inline ember "I'm in" button.
  2. **friend_live** — friend's Avatar, body "Josh went live at Gimme Coffee", timestamp.
  3. **heatmap_hot** — ember-tinted icon with map-pin, body "Heatmap turned hot near you: Collegetown", timestamp + nearby-friend count.
  4. **friend_arrived** — friend's Avatar, body "Maya arrived at Maxie's", timestamp.
  5. **milestone** — dusk-tinted icon with trophy, body "You earned the Prometheus avatar", timestamp + subline.

Unread items have an ember `LiveDot` on the right edge. Tapping marks read.

**Tap behavior:**
- gather_invite → Gather screen for that gather.
- friend_live, friend_arrived → Venue detail for the relevant venue (or friend profile if no venue).
- heatmap_hot → Home/Map zoomed to the relevant area.
- milestone → Profile.

**Empty state (cold start, no notifications):** "Nothing yet. When friends go out, this is where you'll hear about it." + a single ghosted example row.

### 7.X Supporting screens & flows (deck-missing, launch-critical)

#### 7.X.1 Permissions sheets

Three sheets, presented sequentially during onboarding. Each is a full-screen bottom sheet with:
- An illustration (Skia) showing the *behavior*, not the abstract concept (e.g., for location: an animated stylized map with a single ember pulse).
- A clear headline ("So your friends can see you when you go live").
- One sentence of microcopy explaining what we do AND what we don't do ("We only track location while you're live. Never in the background.").
- A primary "Allow" CTA, secondary "Not now" ghost link.

iOS will then show its native permission prompt. We track outcome and route accordingly. If location-always is denied, we fall back to location-when-in-use and explain the degraded experience.

#### 7.X.2 Geofence detection prompt

Triggered when the auto-snap is ambiguous (2-4 candidate venues). Presented as a bottom sheet (40% screen height):

- Headline: "Where are you?"
- Sub: "We picked up a few spots near you."
- Venue chips, each with Bonfire score + distance. Tap one → confirmed.
- Below: "None of these" ghost link → leaves `venue_id` null.

This sheet must appear with a haptic `selection` and never auto-dismiss — confidence in the detection is the whole game.

#### 7.X.3 Profile

Top: hero band with the user's Avatar at hero size (96px), display name, edit pencil. Below the avatar: badge slots (Prometheus, Chef's Hat, two MVP badges — earned and locked rendered identically with locked at 30% opacity). Then: "Your circles" — horizontal scroll of circle chips. Then: settings entry row.

#### 7.X.4 Settings

Sectioned list:
- **Privacy**: Default visibility for Go Live (circles), Do-not-disturb hours (time-of-day window during which we suppress push and don't broadcast presence), Pause Bonfire (toggle, hides you from everyone immediately).
- **Notifications**: Per-kind toggles for the five inbox kinds, plus push vs in-app-only.
- **Circles**: Shortcut to Network.
- **Account**: Phone number, sign out, delete account (destructive, requires confirmation typing).
- **About**: Version, privacy policy, terms.

#### 7.X.5 Friend profile (`profile/[id]`)

Avatar hero, display name, mutual circles list, "Live activity" feed for that friend (last 5 presence events visible to you). Bottom action: "Add to circle" / "Remove from circle". This is also reachable from any Avatar tap on Map, Around, or Inbox.

---

## 8. Build Sequence

Eleven milestones. Each is independently demonstrable and ends in a merged PR.

| # | Milestone | Why now | Verification |
|---|---|---|---|
| **0** | **Design system foundation** — fonts loaded, color/spacing/type tokens, base components (`Avatar`, `Card`, `Chip`, `CTAButton`, `LiveDot`, `BonfireScore`) with NativeWind config, a `/components-preview` route showing every component | Every later screen composes from this. Building these last forces inconsistency. | Components preview route renders cleanly on iOS + Android; no raw hex codes anywhere outside tokens |
| **1** | **Supabase project + schema** — migrations for all tables in §5, RLS policies, seed venues (50 in Ithaca + 50 in NYC LES/EV/UWS) | Backend skeleton before any screen needs data | Migrations apply; RLS policies tested via SQL fixtures |
| **2** | **Auth + onboarding contacts (Screen 1, no map dependency)** — welcome/phone/OTP, permissions sheets, contact hashing, friend matching, first-circle creation | Gets us a user model with friends and a circle — the prerequisite for everything | Real device sign-up → reach Home (which is empty for now) |
| **3** | **Network (Screen 7) + circle detail + add-friend** — backend already exists from milestone 1, just needs UI | Same data layer as onboarding; ships fast | Can create/edit/leave circles; can add a friend by phone |
| **4** | **Go Live (Screen 3) + presence_events writes** — including expo-location capture, venue snap-to-place, geofence detect prompt | First time Realtime matters | Two test devices: A goes live → B's Realtime subscription receives the event within 2s |
| **5** | **Home / live map (Screen 2)** — MapLibre integration, custom warm style JSON, friend pins, heatmap Skia overlay, presence subscriptions, FAB → Go Live | The highest-risk technical screen — gets the map proven before later screens depend on it | Two devices live → both see each other's avatars on the map with breathing pulse |
| **6** | **Around (Screen 4)** — same subscription data as Home, list shape | Cheap once Home works; ships the accessibility surface | List reflects the same presence events as the map; toggle button switches between Home and Around |
| **7** | **Venue Detail (Screen 5)** — depends on snap-to-place from milestone 4 | Now that presence events have venues attached, this screen is meaningful | Tap a venue from the map or Around → see friends-here, activity, Bonfire score |
| **8** | **Inbox (Screen 8) + push** — denormalized fan-out from presence_events + gather_responses, Expo push integration | Once enough events are generated, fan-out is the gap | Friend goes live → I get a push within 5s and a row in Inbox |
| **9** | **Gather (Screen 6) + creation flow + OpenTable/Resy lookup** — last because it depends on everyone being able to go live, get notified, and look up venues | Reservations are the most external-dependency-heavy piece | Create a gather with 3 friends → all 3 receive invite in inbox → "I'm in" reflects in real time; reservation strip shows availability for venues with OT/Resy IDs |
| **10** | **Profile + settings** — needed for ship but not blocking any other milestone | Polish before launch | Can view own profile, edit display name, change DND hours, pause Bonfire |
| **11** | **Empty states + onboarding polish + animation pass** — the "delight" pass that pushes everything from working to feeling alive | Last because polish on broken features wastes work | Every empty state checked against §7; heatmap pulse, contact-toggle sparks, go-live confetti, all tuned |

**Critical path:** 0 → 1 → 2 → 4 → 5. Everything else parallelizes once milestone 5 is done.

**Demo-ready waypoints:** Milestone 5 (map works, two friends can see each other), Milestone 7 (full discovery loop minus async coordination), Milestone 9 (full product).

---

## 9. Out of Scope (MVP)

Documented to prevent scope creep, not to forbid future work.

- **Group chat inside gathers.** "I'm in" + venue + reservation is enough coordination for the MVP. Chat is a v2 decision.
- **Public events / discovery beyond friends-of-friends.** The whole point is intimate circles.
- **Photo posts, stories, any post-event content.** Bonfire is real-time only.
- **Stranger discovery, dating affordances.** Hard line.
- **Android-specific polish.** Code is cross-platform but design is tuned for iOS first.
- **Web companion.** Possibly a v2 for managing circles from desktop.
- **Premium features, monetization.** Free during MVP.
- **AI features.** None. Not "AI-powered suggestions," not "AI recap." The product is about humans seeing each other.

---

## 10. Open Questions

Flagged for resolution before implementation begins on the relevant milestone.

1. **Venue seed source.** Foursquare API costs money. OSM POIs are free but messy. Plan: manually curate 50 venues per launch city for MVP; switch to OSM ingestion in v2.
2. **OpenTable/Resy authorization.** Both have approval workflows. Plan to apply during milestone 1, with read-only availability as the MVP scope. If neither approves in time, fall back to a manual "Book at [venue]" deep-link.
3. **Push notification copy.** Need a copy pass with the actual UX writing voice before milestone 8.
4. **Custom map tile hosting.** Decide between (a) self-hosted Protomaps `.pmtiles` on Supabase Storage (free but operational), or (b) MapTiler ($99/mo Maker tier). Decision before milestone 5.
5. **Avatar color assignment.** Fixed at signup or user-chosen? MVP plan: fixed (deterministic from user id hash) to enforce visual variety; let users customize in v2.

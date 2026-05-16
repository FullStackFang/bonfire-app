# Bonfire — Design Context

## Users

College-aged and post-college social adults (initial wedge: Cornell, NYC) who want to spend more time with the friends they already have, in real life, without the cold-start of a group text. Used in moments of restless availability — "I'm out and would join something if it were happening" — and in the 30 minutes before a night out. Phone-in-hand, often walking, sometimes one-thumb.

The competing behavior is the WhatsApp group chat ("anyone around?"). The product wins when finding a friend already out feels less awkward than typing.

## Brand Personality

**Three words: warm, kinetic, intimate.**

- **Warm** because the product is named Bonfire. The ember/coral is non-negotiable. Surfaces should feel like the inside of a lit room, not the inside of a phone OS.
- **Kinetic** because the value of the product is *liveness* — presence updates, heatmap pulses, friends arriving. The UI must move. Static social UI feels dead here.
- **Intimate** because circles are a trust boundary. The aesthetic must signal small, close, hand-built — not a feed for strangers.

**Emotional goals:** confidence that the people on screen are real friends; FOMO-as-permission (you're invited, you're not intruding); the warmth of a porch light.

## Aesthetic Direction

**Theme: warm light, with a true night surface for "out tonight" and map after sunset.** Not a dark mode toggle — a contextual mode bound to time-of-day and intent state. Day surfaces are cream and ember on near-white. Night surfaces are deep ink with ember holding hue.

**Visual tone: editorial warmth × kinetic data.** Think a small-press lifestyle magazine that learned to render real-time heatmaps. Generous serif headlines. Clean sans for UI. Numeric data (Bonfire score, distance, party size) treated as typographic events, not chips. The map is the hero and gets shader-quality treatment — radial heat with subtle noise, no Mapbox-default purple-blue.

**References (feel, not copy):**
- The warmth of Are.na's editorial typography and asymmetric layouts.
- The kinetic density of a Bloomberg terminal — but warm.
- Find My's restraint with avatars on a map, but with personality.
- The way a campfire scene lights faces unevenly — light should pool, not flood.

**Anti-references (explicitly NOT this):**
- Instagram/Facebook flat material — no gray-on-blue corporate social.
- Snap Map's cartoon Bitmoji warmth — too playful, not intimate.
- Dating-app gloss — no glassmorphism, no aurora gradients, no AI-purple.
- BeReal's brutalist black/yellow — wrong temperature.
- Any "friends finder" app that looks like a Silicon Valley pitch deck.

**The one thing someone remembers:** the avatars on the map *breathe* — a slow, ember-colored pulse around anyone currently live, with the heatmap warming and cooling as friends arrive and leave. The map feels like a living room, not a screen.

## Design Principles

1. **The map is the product.** Every other screen is in service of getting you back to the map, or away from it toward a venue. The map deserves the most engineering and the most aesthetic ambition.

2. **One required action.** "Go live" is the only thing the user must do. Everything else — venue detection, heatmap, social proof — happens to them. The UI for that one action gets a disproportionate amount of polish.

3. **Avatars are characters, not data points.** Each circle member has a color and a letter pair. Treat them like type — kerned, layered, breathing. Never flatten into generic dots.

4. **Numbers as typography.** Bonfire score, distances, friends-here counts: set them with care. Numeric Sentient italic at a generous size beats a chip every time.

5. **Heat is hue.** The heatmap is not a viz layer — it's the brand. Ember radial gradients, soft falloff, slow pulse. When the map warms up, the whole interface warms up.

6. **Light pools, doesn't flood.** Reserve full ember saturation for live state and primary CTAs. Idle surfaces are cream with the faintest ember tint in neutrals. The contrast between idle and live should feel like a flame catching.

7. **Motion is meaning.** Reanimated worklets for every state change worth marking — go-live confirmation, heatmap warming, friend arrival. Spring physics, not linear. Haptics on every signal commit.

8. **No empty empty-states.** Cold-start is where this product dies. Every empty state teaches the next gesture and shows a believable future state lightly ghosted in.

## Typography

**Display: Sentient (Indian Type Foundry / FontShare).** A warm contemporary serif with confident italics. Used for screen titles ("Build your bonfire", "Around you"), Bonfire scores, and any numeric data that deserves to feel typeset. Not Fraunces, not Playfair, not Cormorant.

**UI: Switzer (FontShare).** A clean modern grotesk with enough character in its lowercase a and g to not read as Inter. Used for all body, labels, buttons, list rows.

**Numeric accent: Fragment Mono (FontShare).** Reserved for timestamps ("2 min ago"), coordinates, distance readouts when they appear in dense activity feeds. Used sparingly.

Pairing logic: the serif carries warmth and editorial confidence; the sans carries information density without coldness; the mono grounds the live-data feel of activity feeds.

## Color

Built in OKLCH, tinted toward the ember hue (~30°) across all neutrals so the entire interface reads as living in the same room as the brand color.

- **Ember** (primary): `oklch(66% 0.19 30)` — the bonfire color. Used for go-live state, primary CTAs, heatmap core.
- **Ember Deep** (pressed/dark surfaces): `oklch(48% 0.16 28)`
- **Ember Glow** (heatmap falloff): `oklch(78% 0.12 35)` at ~20% opacity
- **Coal** (text on light): `oklch(22% 0.02 30)` — warm near-black, never pure
- **Smoke** (secondary text): `oklch(52% 0.015 30)`
- **Ash** (borders, dividers): `oklch(88% 0.008 30)`
- **Cream** (surface): `oklch(98% 0.012 60)` — the warm base
- **Hearth** (card surface): `oklch(100% 0 0)` softened — pure white but on cream it reads warm
- **Spark** (available/live indicator): `oklch(68% 0.15 145)` — sage-leaning green, not iOS green
- **Dusk** (out-today): `oklch(70% 0.14 55)` — sunset amber
- **Night** (out-tonight, dark surfaces): `oklch(28% 0.04 260)` — true deep blue-black

The 60-30-10 split: 60% cream/hearth, 30% coal/smoke, 10% ember. Spark/Dusk/Night are intent-state accents, not part of the everyday palette.

## Motion

- Reanimated 3 worklets on every interactive surface that crosses a state boundary.
- Springs only (`mass: 1, damping: 22, stiffness: 220` as the house spring). No linear, no bouncy.
- Heatmap pulse: 3.2s period, sine-eased radial gradient breathing on live circles.
- Haptic mapping: `selection` on chip taps, `light` on toggle, `success` on go-live commit, `medium` on "I'm in", `warning` on permission denial.
- Page transitions: slide-up from bottom for Go Live and Venue Detail (committal screens); horizontal native push for navigation tabs.
- Reduce Motion: collapse pulses to a single static glow, keep haptics, keep state colors.

## Constraints

- **Stack:** Expo 54 / Expo Router 6 / React Native 0.81 / Reanimated 3 / NativeWind 4 / MapLibre Native (via `@maplibre/maplibre-react-native`) / Supabase (auth + Postgres + Realtime + Storage).
- **Platforms:** iOS first. Android-compatible code but no Android-specific polish in MVP.
- **Accessibility:** WCAG AA contrast for text on cream and on night. All map information must have a non-map equivalent (the Around list). VoiceOver labels for every interactive element. Reduce Motion honored throughout.
- **Performance budget:** 60fps on iPhone 12 and up. Map with 100 visible friend pins + 30 heatmap cells must stay above 55fps during pan.

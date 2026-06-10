# Bonfire — Design Context

> v2 (June 9, 2026). Canonical product spec: `docs/superpowers/specs/2026-06-09-bonfire-mvp-spec-v2.1.md`. This file is the design doctrine that tooling and sessions read first — it describes the v2 product (gated neighborhood groups, weekly ritual, mortal fire), not the v1 friend-presence app.

## Users

WFH and hybrid professionals in one walkable NYC neighborhood — people who lost ambient workplace community and live somewhere dense enough to rebuild it. They are not strangers and not yet friends: 15–50 semi-familiar faces, gated by vouch, anchored to the same streets.

Moments of use: the Tuesday-night T-48h decision (venue revealed, one tap in or out); the Thursday anchor (check in, one tap, phone back in pocket); restless availability between anchors ("I'm here for the next hour" — pulse); weekend solo exploration (lighting your personal map, scouting embers for the group). Phone-in-hand briefly, by design — the product's job is to get the phone back in the pocket and the body into the room.

The competing behavior is staying home, and the group chat that never converges into a plan. The product wins when showing up feels lighter than negotiating.

## Brand Personality

**Three words: warm, kinetic, intimate.**

- **Warm** because the product is named Bonfire. The ember/coral is non-negotiable. Surfaces should feel like the inside of a lit room, not the inside of a phone OS.
- **Kinetic** because the value of the product is *liveness* — and the liveness is the fire: heat rising, states falling, check-ins landing, territory igniting. The UI must move because the fire is alive. And mortal.
- **Intimate** because the gate is a trust boundary. Twenty-five faces that repeat. The aesthetic must signal small, close, hand-built — not a feed for strangers.

**Emotional goals:** the fire reads genuinely alive — and genuinely mortal; warmth on screen is always *earned* warmth (real bodies, real nights — never simulated); credit lands by name (*found by Maya*); guilt is only ever collective (the fire dims for everyone; no individual shame). The porch light became a hearth.

## Aesthetic Direction

**Theme: warm light against earned darkness.** Day surfaces are cream and ember on near-white. The group map is true night — fog-of-war ink that only co-presence lights. Not a dark-mode toggle: darkness is the game board.

**Visual tone: editorial warmth × kinetic data.** Think a small-press lifestyle magazine that learned to render a living fire. Generous serif headlines. Clean sans for UI. Numeric data (heat, "12 of you," nights lit) treated as typographic events, not chips. The fire is the hero object and gets the most craft; the map is the memory and gets shader-quality glow on every light the group has earned.

**References (feel, not copy):**
- The warmth of Are.na's editorial typography and asymmetric layouts.
- The kinetic density of a Bloomberg terminal — but warm.
- Find My's restraint with avatars on a map, but with personality.
- The way a campfire scene lights faces unevenly — light should pool, not flood.
- A Tamagotchi's stakes with a hearth's dignity — alive, mortal, never cartoon.

**Anti-references (explicitly NOT this):**
- Instagram/Facebook flat material — no gray-on-blue corporate social.
- Snap Map's cartoon Bitmoji warmth — too playful, not intimate.
- Dating-app gloss — no glassmorphism, no aurora gradients, no AI-purple.
- BeReal's brutalist black/yellow — wrong temperature.
- Any "community" app that looks like a Silicon Valley pitch deck.
- **Simulated warmth** — no peppy empty states, no inflated counts, no fake glow. A quiet fire is quiet.

**The one thing someone remembers:** the fire itself — one living flame whose state you can read across the room — and behind it, the dark map with pools of light the group actually earned.

## Design Principles

1. **The fire is the product.** It owns the home screen and the front door. It is the north-star metric rendered as an object. The map serves memory, not navigation. Every other screen is in service of feeding the fire or remembering what it lit.

2. **One required action: check in.** One tap, venue auto-suggested, done. Everything else — heat, territory, credit, notifications — happens *to* the user. The UI for that one action gets a disproportionate amount of polish, and a small ceremonial weight: it's a toast, not a chore.

3. **The scoreboard must not lie — in either direction.** Fake warmth is worse than a calendar. But lost check-ins that make a warm night read cold are just as fatal. Capture every body in the room; never inflate, never deflate.

4. **Darkness is correct.** The unlit map is not an empty state — it's the game board. Light is earned by co-presence only. Empty states elsewhere teach the next gesture; the dark map *is* the teaching.

5. **Blame the group, credit the person.** Credit is individual and named — *found by Maya*, the torch, "Maya's in." Stakes are collective — the fire dims for everyone. **Absence is never displayed.** No out-lists, no flake records, no individual streaks, no guilt UI.

6. **Numbers as typography.** Heat, head-counts, nights lit: set them with care. Numeric serif italic at a generous size beats a chip every time.

7. **Heat is hue.** The fire and the lit territory are not a viz layer — they're the brand. Ember radial gradients, soft falloff, slow pulse. When the fire roars, the whole interface warms up.

8. **Light pools, doesn't flood.** Reserve full ember saturation for the live fire, lit territory, and primary CTAs. Idle surfaces are cream with the faintest ember tint in neutrals. The contrast between a dimming fire and a roaring one should feel like a flame catching.

9. **Motion is meaning.** Reanimated worklets for every state change worth marking — check-in commit, ignition, fire-state transitions, a pulse going out. Spring physics, not linear. Haptics on every signal commit. The fire breathes on a slow sine; Rive's state machine drives its life.

10. **If it doesn't produce co-presence, we don't build it.** No feed, no profiles, no posts, no chat. The app is the scoreboard; the game is played offline.

## Typography

**Display: Sentient (Indian Type Foundry / FontShare).** A warm contemporary serif with confident italics. Used for screen titles ("The fire is burning", "Lit March 12"), heat and head-count numerals, and any data that deserves to feel typeset. Not Fraunces, not Playfair, not Cormorant. (Source Serif 4 ships as the stand-in until a local .otf is available.)

**UI: Switzer (FontShare).** A clean modern grotesk with enough character in its lowercase a and g to not read as Inter. Used for all body, labels, buttons, list rows. (Onest ships as the stand-in.)

**Numeric accent: Fragment Mono (FontShare).** Reserved for timestamps ("2 min ago"), distances, and live pulse countdowns. Used sparingly. (Geist Mono ships as the stand-in.)

Pairing logic: the serif carries warmth and editorial confidence; the sans carries information density without coldness; the mono grounds the live-data feel of pulses and check-ins.

## Color

Built in OKLCH, tinted toward the ember hue (~30°) across all neutrals so the entire interface reads as living in the same room as the brand color. The palette is unchanged from v1; the *semantic roles* are re-mapped to v2:

- **Ember** (primary): `oklch(66% 0.19 30)` — the bonfire color. The living fire, lit territory cores, primary CTAs, the "here now" state.
- **Ember Deep** (pressed/dark surfaces): `oklch(48% 0.16 28)`
- **Ember Glow** (heat falloff): `oklch(78% 0.12 35)` at ~20% opacity — halos on lit venues and checked-in faces.
- **Coal** (text on light): `oklch(22% 0.02 30)` — warm near-black, never pure
- **Smoke** (secondary text): `oklch(52% 0.015 30)`
- **Ash** (borders, dividers): `oklch(88% 0.008 30)`
- **Cream** (surface): `oklch(98% 0.012 60)` — the warm base
- **Hearth** (card surface): pure white softened by cream surroundings
- **Spark** (happening now): `oklch(68% 0.15 145)` — sage-leaning green, not iOS green. Active pulses, live check-ins.
- **Dusk** (embers): `oklch(70% 0.14 55)` — sunset amber. Venues staked by a member, awaiting ignition.
- **Night** (the fog of war): `oklch(28% 0.04 260)` — true deep blue-black. The unlit group map; the dark the group lights up.

The 60-30-10 split: 60% cream/hearth, 30% coal/smoke, 10% ember. Spark/Dusk/Night are state accents, not part of the everyday palette.

## Motion

- Reanimated 3 worklets on every interactive surface that crosses a state boundary.
- Springs only (`mass: 1, damping: 22, stiffness: 220` as the house spring). No linear, no bouncy.
- The fire breathes: slow sine cadence (3.2s period) at rest; Rive state machine drives transitions between Roaring / Burning / Dimming / Embers / Out. A state transition is an event — marked, never instant.
- Lit territory and active pulses share the breathing cadence, in phase.
- Haptic mapping: `selection` on chip taps, `light` on toggle, `medium` on check-in commit and "I'm in", `success` on ignition (a venue lighting), `warning` on permission denial.
- Page transitions: slide-up from bottom for check-in, pulse, and ember drop (committal screens); horizontal native push for tabs.
- Reduce Motion: collapse pulses and breathing to a single static glow, keep haptics, keep state colors.

## Constraints

- **Stack:** Expo 54 / Expo Router 6 / React Native 0.81 / Reanimated 3 / NativeWind 4 / Supabase (auth + Postgres + PostGIS + Edge Functions) / Rive (fire animation). Map: `@maplibre/maplibre-react-native` on native, `maplibre-gl` on web, behind one MapStage interface.
- **Platforms:** **Web PWA first** (react-native-web, Vercel, Safari Add to Home Screen as a hard onboarding step — iOS web push requires it). Native iOS via EAS/TestFlight is phase 2 from the same codebase. Android-compatible code but no Android polish in MVP.
- **Auth:** 6-digit email OTP. No magic links — a link tap opens Safari, not the installed PWA, and strands the session.
- **Accessibility:** WCAG AA contrast for text on cream and on night. All map information must have a non-map equivalent (lit-spots list, ember list). VoiceOver/screen-reader labels for every interactive element. Reduce Motion honored throughout.
- **Performance budget:** the fire at 60fps on iPhone 12-era Safari and up; group map with ~50 lit venues + ember markers stays above 55fps during pan.

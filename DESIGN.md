---
name: Bonfire
description: Warm, kinetic, intimate. A small group's living fire — fed only by showing up, mapped in earned light.
colors:
  ember: "#f05846"
  ember-deep: "#a52a24"
  ember-glow: "#fa9b82"
  spark: "#54b05a"
  dusk: "#e0843e"
  night: "#1d293d"
  coal: "#231715"
  smoke: "#716664"
  ash: "#ddd6d4"
  cream: "#fff7f1"
  hearth: "#ffffff"
  shadow-warm: "#c8b8b1"
typography:
  display:
    fontFamily: "SourceSerif4_400Regular_Italic"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: "40px"
  headline:
    fontFamily: "SourceSerif4_400Regular"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: "34px"
  title:
    fontFamily: "SourceSerif4_500Medium"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: "28px"
  body-lg:
    fontFamily: "Onest_400Regular"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "24px"
  body:
    fontFamily: "Onest_400Regular"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  body-sm:
    fontFamily: "Onest_500Medium"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
  mono-sm:
    fontFamily: "GeistMono_400Regular"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  overline:
    fontFamily: "Onest_500Medium"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "14px"
    letterSpacing: "1.1px"
rounded:
  pill: "999px"
  card: "20px"
  control: "16px"
  control-sm: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.hearth}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "56px"
  button-primary-pressed:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.hearth}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "56px"
  button-outline:
    backgroundColor: "{colors.hearth}"
    textColor: "{colors.ember}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "56px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.coal}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "56px"
  chip-solid:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.hearth}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  chip-outline:
    backgroundColor: "{colors.hearth}"
    textColor: "{colors.coal}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.hearth}"
    rounded: "{rounded.card}"
    padding: "16px"
  map-control:
    backgroundColor: "{colors.hearth}"
    textColor: "{colors.coal}"
    rounded: "26px"
    size: "52px"
---

# Design System: Bonfire

## 1. Overview

**Creative North Star: "The campfire on a screen."**

Bonfire is the inside of a lit room rendered as a phone interface. The brand is **warm, kinetic, intimate** — three words from `PRODUCT.md` that are doctrine, not adjectives. Surfaces feel like a small-press lifestyle magazine that learned to render real-time heatmaps. Type is editorial. Numbers are typeset. The fire is the hero — a single living flame the whole group keeps alive, fed only by bodies in the room. The map is the memory: dark until the group lights it, with shader-quality glow on every earned light. Everything else is in service of the one required action: **Check in.**

Buttons are deliberately chunky — confident 3D press, ember on ember-deep, satisfying to tap. They borrow the tactile vocabulary of Duolingo applied with restraint, so the app feels physical and committed without becoming cartoon. The fire and the lit territory breathe in a 3.2-second sine cadence; checked-in members carry ember halos around them. The interface, taken in still frames, looks editorial. Taken in motion, it looks alive.

This system explicitly rejects the visual cliches of the category. From `PRODUCT.md` anti-references, repeated here as design law: **no Instagram/Facebook gray-on-blue corporate flat. No Snap Map cartoon Bitmoji warmth. No dating-app gloss. No glassmorphism, no aurora gradients, no AI-purple. No BeReal brutalist black-and-yellow.** "Friends finder that looks like a Silicon Valley pitch deck" is the exact failure mode to avoid.

**Key Characteristics:**
- Cream-on-ember palette with strict 60/30/10 distribution.
- Editorial Source Serif italic for display + Onest for UI + Geist Mono for live data.
- Chunky 3D-press buttons with ember-deep shadows. Never a flat material button.
- Fire as hero — a state-machine flame (Roaring → Burning → Dimming → Embers → Out). Map as memory: a fog-of-war dark surface with breathing pools of earned light.
- Light pools, doesn't flood. Full ember saturation is reserved for live state and primary CTAs.
- Motion is meaning. Reanimated 3 worklets on every state crossing. Spring physics, sine for pulses.

## 2. Colors: The Warm Palette

The system is tinted toward ember (~30°) across all neutrals so every surface reads as living in the same room as the brand color. Built in OKLCH (canonical values below); hex values in the frontmatter are sRGB approximations for Stitch compliance.

### Primary
- **Ember** (`#f05846` / `oklch(66% 0.19 30)`): the bonfire color. Used for the primary CTA face, the living fire, the heat core of lit territory, and the active "here now" indicator. Never used as decoration.
- **Ember Deep** (`#a52a24` / `oklch(48% 0.16 28)`): the shadow under every ember button. Carries the 3D press effect. Also used for pressed/dark surface states.
- **Ember Glow** (`#fa9b82` / `oklch(78% 0.12 35)`): the breathing halo around checked-in members and lit venues at ~22–54% opacity. Heat falloff color.

### Secondary
- **Spark** (`#54b05a` / `oklch(68% 0.15 145)`): sage-leaning green for the "happening now" dot — active pulses, live check-ins. **Not iOS green.** Used only as a state marker, never as a fill.

### Tertiary
- **Dusk** (`#e0843e` / `oklch(70% 0.14 55)`): sunset amber for embers — venues staked by a member, awaiting ignition. Used only as a state marker.
- **Night** (`#1d293d` / `oklch(28% 0.04 260)`): true deep blue-black for the fog-of-war group map — the unlit city the group lights up. **The game board, not a dark-mode toggle.**

### Neutral
- **Coal** (`#231715` / `oklch(22% 0.02 30)`): warm near-black for body text on light surfaces. Never pure black.
- **Smoke** (`#716664` / `oklch(52% 0.015 30)`): secondary text, placeholder text, inactive icons.
- **Ash** (`#ddd6d4` / `oklch(88% 0.008 30)`): hairline borders and dividers.
- **Cream** (`#fff7f1` / `oklch(98% 0.012 60)`): the base surface of every screen. The room.
- **Hearth** (`#ffffff`): the card surface. Reads warm against cream.
- **Shadow Warm** (`#c8b8b1`): the bottom layer under hearth-faced chunky buttons. Provides 3D press for outline / secondary actions.

### Named Rules

**The Light-Pools Rule.** Full ember saturation is reserved for the live state and the primary CTA. Idle surfaces are cream with the faintest ember tint in neutrals. The contrast between idle and live should feel like a flame catching.

**The 60/30/10 Rule.** 60% cream / hearth, 30% coal / smoke, 10% ember. Spark, dusk, and night are intent-state accents, not part of the everyday palette.

**The No-Pure-Black Rule.** `#000` is forbidden. Use **Coal** (`#231715`). All neutrals must be tinted toward the ember hue.

## 3. Typography

**Display Font:** Source Serif 4 (stands in for Sentient until a local .otf is available)
**Body Font:** Onest (stands in for Switzer)
**Mono Font:** Geist Mono (live-data accent)

**Character:** the serif carries warmth and editorial confidence. The italic in particular is the workhorse of display copy — "Build your bonfire", "Around you" — and gives the system its small-press magazine voice. Onest is a clean modern grotesk with enough character in its lowercase `a` and `g` to not read as Inter. Geist Mono grounds activity feeds and timestamps in a technical register.

### Hierarchy
- **Display** (italic, 34/40, `SourceSerif4_400Regular_Italic`): screen titles. "The fire is burning", "Lit March 12".
- **Headline** (regular, 28/34, `SourceSerif4_400Regular`): section openers and large numeric data (heat, head-counts — "12 of you" — as typography).
- **Title** (medium, 22/28, `SourceSerif4_500Medium`): card titles, modal headers.
- **Body Lg** (regular, 17/24, Onest): primary reading copy.
- **Body** (regular, 15/22, Onest): default UI copy, list rows.
- **Body Sm** (medium, 13/18, Onest): chip labels, metadata, button labels in small contexts.
- **Mono Sm** (regular, 12/16, Geist Mono): timestamps, coordinates, "2 min ago" in activity feeds. Used sparingly.
- **Overline** (medium, 11/14, Onest, letter-spacing 1.1): section labels above lists. ALWAYS UPPERCASE.

### Named Rules

**The Numbers-As-Typography Rule.** Heat, head-counts, nights-lit tallies: set them in display italic at a generous size. **Forbidden:** chips wrapping numeric data.

**The One-Italic Rule.** Italic is reserved for display copy. Body copy is never italic. Italics in UI labels are forbidden.

## 4. Elevation

Bonfire uses **structural depth, not ambient shadow.** Most surfaces are flat by default. The exception is the **chunky press**: every interactive button (primary CTA, FAB, map controls) sits on a coloured layer offset 4–6px below it, so the button reads as physical and pressable. The shadow color is a darker shade of the button's own family (ember-deep under ember, shadow-warm under hearth). On press, the button face translates down to meet its shadow.

There are no ambient drop shadows on cards, modals, or chips. Depth is conveyed entirely by the coloured offset under interactive elements.

### Shadow Vocabulary
- **Chunky depth — primary action** (face: ember; shadow: ember-deep; offset 5–6px): Check-in FAB, primary CTAs.
- **Chunky depth — secondary action** (face: hearth; shadow: shadow-warm `#c8b8b1`; offset 4–5px): Recenter button, Continue buttons in outline variant.

### Named Rules

**The Flat-Card Rule.** Cards and modals do not carry ambient drop shadows. They sit on cream with a hairline ash border (`#ddd6d4`, 1px) or no border. If a surface needs to feel lifted, give it the chunky press treatment — not a soft blur.

**The Press-Eats-Shadow Rule.** When a chunky button is pressed, the button face translates down by exactly its `depth` value, fully covering the shadow. There is no "still see the shadow under the pressed button" state.

## 5. Components

The full reference implementation lives in `apps/mobile/components/ui/` and `apps/mobile/components/map/`.

### Buttons (`ChunkyPressable`, `CTAButton`)
- **Character:** confident, physical, friendly. A press should feel like clicking a real-world button — satisfying, not flat.
- **Shape:** pill (`borderRadius: 999`) or round (control radius `26px` for map controls). Square corners are forbidden.
- **Primary** (`<CTAButton variant="primary">`): ember face on ember-deep shadow, depth 5, height 56, padding 0/22. Label in Onest 600 SemiBold 17px, hearth text, letter-spacing 0.2.
- **Outline** (`<CTAButton variant="outline">`): hearth face on shadow-warm shadow, depth 5, hairline 1.5px shadow-warm border, ember text label.
- **Ghost** (`<CTAButton variant="ghost">`): flat text button, no shadow, used only for "skip" / "not now" affordances.
- **Map controls** (FAB, recenter): use `ChunkyPressable` directly with `depth: 4`, `radius: 26`. 52×52 face. Right-edge stack at `right: 18`.
- **Press behaviour:** spring (`houseSpring`: mass 1, damping 22, stiffness 220). Haptic on every commit (selection by default; medium for check-in).

### Chips (`Chip`)
- **Style:** pill shape, four variants — `solid` (ember fill, hearth text), `outline` (hearth fill, ash 1px border, coal text), `ghost` (transparent, smoke text), `tinted` (tint at 12% opacity, tint as text).
- **Sizes:** `sm` (paddingV 6, paddingH 10, font 11), `md` (paddingV 8, paddingH 14, font 13).
- **State:** selected = `solid`; unselected = `outline`. Filter chips and action chips share the same vocabulary.

### Cards (`Card`)
- **Shape:** 20px corner radius.
- **Background:** hearth (`#ffffff`).
- **Shadow:** none. Hairline ash border (1px `#ddd6d4`) when needed for separation; no border when stacked in a list with row separators.
- **Internal padding:** 16px default; 12px for dense list rows; 20px for primary content cards.

### Inputs (search pill, name field)
- **Style:** pill shape (`borderRadius: 999`), hearth background, 1px ash border, 14px horizontal padding, 40px height.
- **Focus:** border deepens to ember 1.5px. No glow, no soft shadow.
- **Search pill:** leading search icon (smoke), placeholder copy in smoke.

### Navigation (Tab Bar)
- **Style:** 64pt height, hearth background, hairline ash top border. Tab labels in Onest 500 Medium 11px. Active = ember (`{colors.ember}`); inactive = smoke (`{colors.smoke}`). Icons via Ionicons.

### Avatars (`Avatar`, `AvatarStack`)
- **Shape:** circle. Sizes `xs` 24, `sm` 32, `md` 40, `lg` 48, `xl` 64, `hero` 96.
- **Color:** one of six avatar accents from `avatarAccents` (blue / green / purple / orange / amber / slate). Assigned deterministically by user id hash.
- **Photo-first:** real faces, required at onboarding — faces must repeat. Letter pair (two initials, Onest 600 SemiBold, hearth on accent) only as a fallback for missing photos.
- **Live state:** animated emberGlow halo around the avatar at 22–54% opacity, scale 1.12–1.30, 3.2s sine cycle. Reduce Motion collapses to static glow.

### Map Controls
- **Size:** 52×52 face on 4px depth.
- **Style:** hearth face on shadow-warm shadow with 1px shadow-warm border; ember border when active.
- **Icon:** 22px Ionicons, coal color (ember when active).
- **Placement:** right edge stack at `right: 18`, above the tab bar. FAB sits lowest; auxiliary controls (recenter, etc.) stack above with 8pt gaps.

### Signature: Pulsing Map Pin (`PulsingMapPin`)
The defining moment of the brand. Wide ember halo (2.2× the pin diameter) sits behind every active pulse and freshly lit venue on the map, breathing in a 3.2s sine cycle, in phase with the fire. Opacity 16–38%, scale 0.85–1.25. **This is the thing users should remember.** Reduce Motion collapses it to a static halo at half-phase.

## 6. Do's and Don'ts

### Do:
- **Do** use `CTAButton` from `@bonfire/components/ui` for every primary or outline button across every screen. Never inline a styled `<Pressable>` with rounded corners and a colored background.
- **Do** use `ChunkyPressable` for round map controls and any one-off action button. Pick `depth` 4 for ≤52pt buttons, 5–6 for ≥56pt buttons.
- **Do** set every interactive press to spring physics via `houseSpring`. No linear easing, no bounce.
- **Do** fire a haptic on every commit: `selection` for filter chips, `light` for general buttons, `medium` for check-in, `success` on ignition (a venue lighting).
- **Do** treat numeric data as display typography. Heat, head-count, nights lit: `SourceSerif4_400Regular_Italic`, 34/40 or larger.
- **Do** use ember only for the fire, lit/live state, and primary CTAs. Idle ember is forbidden.
- **Do** honor `prefers-reduced-motion`: collapse pulses to static glows; keep haptics; keep state colors.
- **Do** keep the fire as the front door and the map as the memory. Opening the app should feel like checking the hearth; opening the map should feel like opening a box of photographs, not a directory.

### Don't:
- **Don't** ship glassmorphism. **Forbidden by `PRODUCT.md`:** no `BlurView` as decoration, no frosted-glass overlays, no aurora gradients. The chunky 3D press is the depth vocabulary; blur is not.
- **Don't** use pure black (`#000`) or pure white as the body text or background. Use **coal** and **cream**.
- **Don't** use cartoon warmth (Bitmoji, Snap Map energy). Avatars are real faces — photo-first; letter pairs only as a fallback, never illustration.
- **Don't** wrap numeric data in a chip. Numbers get the typography treatment.
- **Don't** add ambient drop shadows to cards or modals. Depth comes from the chunky press, not from blur.
- **Don't** use linear or cubic-bezier easing on interactive transitions. Spring physics only, with `houseSpring` as the house default.
- **Don't** invent button shapes (squared corners, sharp rectangles, hard-edged tabs). Pills and circles only.
- **Don't** add a dark-mode toggle. Night mode is **contextual** — bound to time-of-day and intent state, not a user preference.
- **Don't** mix icon families. Ionicons throughout.
- **Don't** ship an empty-state that says "Nothing here." Every empty state teaches the next gesture; see `EmptyState` component.
- **Don't** use `BlurView` from `expo-blur` on this app. The package is intentionally unused.

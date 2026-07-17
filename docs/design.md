# Design System

Brand: **warm, kinetic, intimate.** Full doctrine in `PRODUCT.md` and `DESIGN.md`. Prototype flows in `design/`. Component implementations in `apps/mobile/components/ui/` and `apps/mobile/components/map/`.

The fire is the hero object. The map is the memory. The one required action is **check in**.

## Color

**The 60/30/10 rule:** 60% cream/hearth · 30% coal/smoke · 10% ember. Spark, Dusk, Night are state-only accents — not everyday palette.

| Token | Hex | Role |
|---|---|---|
| Ember | `#e8502f` | Living fire, lit/live state, primary CTAs. Never decorative. |
| Ember Deep | `#9e2c1c` | Shadow under ember buttons (3D press). Pressed states. |
| Ember Glow | `#f39472` | Breathing halo at 22–54% opacity around checked-in members and lit venues. |
| Spark | `#54b05a` | "Happening now" dot — active pulses, live check-ins. State marker only. |
| Dusk | `#e0843e` | Venues staked, awaiting ignition. State marker only. |
| Night | `#1d293d` | Fog-of-war map surface. The game board, not a dark-mode toggle. |
| Coal | `#201d1b` | Body text on light surfaces. Near-black, faint warmth. Never pure black. |
| Smoke | `#6b6560` | Secondary text, placeholders, inactive icons. |
| Ash | `#e3dfdb` | Hairline borders and dividers. |
| Cream | `#f6f3ef` | Base surface of every screen — warm paper, balanced not pink. |
| Hearth | `#ffffff` | Card surface — clean white against the paper. |
| Shadow Warm | `#c3bcb4` | Shadow under hearth-face (outline) chunky buttons. |
| Ink | `#2a3140` | Cool slate structural anchor — headers, rails, non-warm edges. |

**Hard rules:**
- Pure black (`#000`) is forbidden. Use Coal.
- Ember is never used as decoration — only for fire, live state, and primary CTAs.
- No glassmorphism. No `BlurView`. No aurora gradients. No AI-purple. No dark-mode toggle (Night is contextual, not a preference).

## Typography

| Role | Font | Size/Line | Usage |
|---|---|---|---|
| Display | Source Serif 4 Italic | 34/40 | Screen titles, large numerics |
| Headline | Source Serif 4 Regular | 28/34 | Section openers, head-counts as typography |
| Title | Source Serif 4 Medium | 22/28 | Card titles, modal headers |
| Body Lg | Onest Regular | 17/24 | Primary reading copy |
| Body | Onest Regular | 15/22 | Default UI copy, list rows |
| Body Sm | Onest Medium | 13/18 | Chip labels, metadata |
| Mono Sm | Geist Mono | 12/16 | Timestamps, distances — used sparingly |
| Overline | Onest Medium | 11/14, +1.1 tracking | Section labels — ALWAYS UPPERCASE |

**Hard rules:**
- Numeric data (heat, head-counts, nights lit) gets display italic at generous size. Chips wrapping numbers are forbidden.
- Italic is for display copy only. Body copy and UI labels are never italic.
- Stand-ins: Source Serif 4 → Sentient, Onest → Switzer, Geist Mono → Fragment Mono (final fonts pending local .otf).

## Buttons and Elevation

Bonfire uses structural depth, not ambient shadow. Every interactive button is a **chunky press**: the face sits on a colored layer offset below it; on press, the face translates down to meet the shadow.

- **Primary** (`CTAButton variant="primary"`): ember face · ember-deep shadow · depth 5 · pill shape · height 56
- **Outline** (`CTAButton variant="outline"`): hearth face · shadow-warm shadow · depth 5 · 1.5px ash border · ember text
- **Ghost** (`CTAButton variant="ghost"`): flat text only — for "skip" / "not now" affordances
- **Map controls / FAB**: `ChunkyPressable` · 52×52 face · depth 4 · `radius: 26` · right-edge stack at `right: 18`

Cards and modals have **no** ambient drop shadows — flat with optional hairline ash border.

**Use `CTAButton` from `apps/mobile/components/ui/` for every button. Never inline a styled `<Pressable>` with rounded corners and a colored background.**

## Motion

- Reanimated worklets on every state boundary crossing. Spring physics only (`houseSpring`: mass 1, damping 22, stiffness 220). No linear or cubic-bezier easing.
- The fire, lit territory, and active pulses breathe at a **3.2s sine cadence**, in phase with each other.
- Haptics: `selection` on chip taps · `light` on general buttons · `medium` on check-in commit · `success` on venue ignition
- Page transitions: slide-up for committal screens (check-in, pulse, ember drop); horizontal native push for tabs.
- `prefers-reduced-motion`: collapse pulses/breathing to static glows; keep haptics and state colors.

## Do's and Don'ts

**Do:**
- Use `houseSpring` for every interactive press animation.
- Honor `prefers-reduced-motion` — static glow, full haptics.
- Keep the fire as the front door. Opening the app = checking the hearth.
- Empty states teach the next gesture (`EmptyState` component). Never "Nothing here."

**Don't:**
- No `BlurView` from `expo-blur` — the package is intentionally unused.
- No simulated warmth — no inflated counts, no peppy empty states, no fake glow. A quiet fire is quiet.
- No squared button corners, no hard-edged tabs. Pills and circles only.
- No ambient drop shadows on cards or modals.
- No feed, no profiles, no posts, no chat. **Absence is never displayed in any form.**
- Don't mix icon families — Ionicons throughout.

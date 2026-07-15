# Bonfire Live Pulse — Design System

**Warm, kinetic, intimate.** Bonfire is a small group's living presence rendered as a phone interface — the inside of a lit room, not the inside of a phone OS. This design system is scoped to **Live Pulse**, the MVP: one shared link per group, web-first, no account. Open it and you see two things — **what people are up to** (presence) and **what's live now** (droppable sparks).

> Live Pulse is the lean presence-plus-sparks product. It shares Bonfire's brand foundation (the ember palette, editorial serif, chunky press) with the broader v2 app (gated groups, the mortal fire, the group map) documented in the source `DESIGN.md` / `PRODUCT.md` — but Live Pulse deliberately drops the fire-as-hero, the map, accounts, and chat. Presence + sparks, group-scoped, pinned; each spark lives and dies on a TTL.

## Sources
This system was distilled from an attached codebase and prototype set:
- **`bonfire-app/`** (local folder) — Expo + Supabase monorepo. Canonical tokens in `packages/ui-tokens/src/{colors,type,spacing,motion}.ts`; full doctrine in `DESIGN.md` and `PRODUCT.md`; design docs in `docs/design.md`.
- **`design/` prototypes** (this project root) — the Live Pulse HTML flows (`Bonfire - The System.html`, `Bonfire MVP Overview.html`, `Bonfire Pulse Link.html`, `Bonfire Web Flow (Appless).html`, `Bonfire Onboarding (App).html`) and their shared React atoms (`bonfire-bits.jsx`, `bonfire-web.jsx`).

Token values here are canonicalized on the **codebase** (`ui-tokens` / `DESIGN.md`) — the shipped source of truth. The HTML prototypes use a very slightly brighter ember (`#FF5C3A` vs the canonical `#f05846`); if you want the system to match the prototypes exactly instead, say so and I'll flip the ember family.

---

## CONTENT FUNDAMENTALS
How Bonfire writes.

- **Voice:** second person, warm and direct. "You're in, Alex." "Tap in and you're on the list." Speaks *to* the user, never *about* them.
- **Tone:** quiet confidence, never peppy. **No simulated warmth** — no inflated counts, no exclamation-mark hype, no "🎉 You did it!". A quiet fire is quiet. Copy states facts about the live moment: "3 out right now · 1 here · 2 on the way."
- **Casing:** sentence case everywhere except OVERLINE labels (always uppercase, +1.1 tracking). Titles are editorial fragments, often lowercase mid-phrase ("who's around tonight").
- **Statements, not questions.** Presence and sparks are declared, never asked. "Sunset at the windmills" is a statement; you tap "I'm in". Never "Going / Maybe / Can't", never RSVP language, never "Invite friends?".
- **Credit by name, blame the group.** "Maya dropped this." Individual credit is warm and named; absence is never displayed — no out-lists, no flake records, no guilt UI. "out" is stated softly in grey, never shamed.
- **Numbers are typeset, not chipped.** Head-counts ("3 out", "6 on the link") are display-italic events, never wrapped in a pill.
- **Em-dashes and apostrophes:** curly quotes (’ “ ”) and em dashes (—) throughout — it reads editorial, small-press.
- **Emoji:** effectively none. The one warm glyph is the ember mark (a CSS flame), used deliberately. No emoji as UI.
- **Sample copy:** "Pick a name your friends will know you by. That's the whole sign-up — no account, no download." · "No app. No sign-up. Tap in and you're on the list." · "Live for the whole trip."

---

## VISUAL FOUNDATIONS

- **Palette — the warm fire.** 60% cream/hearth, 30% coal/smoke, **10% ember**. Ember (`#f05846`) is *earned*: fire, live state, and primary CTAs only — never decoration. Spark (green, happening-now), Dusk (amber, on-my-way / awaiting), and Night (deep blue-black) are **state markers only**, never everyday fills. Every neutral is tinted toward the ember hue (~30°) so the whole UI reads as living in one warm room. **Pure black `#000` is forbidden — use Coal.**
- **The Light-Pools Rule.** Full ember saturation is reserved for live state + primary CTA. Idle surfaces are cream with the faintest ember tint. Idle→live should feel like a flame catching.
- **Type — editorial × kinetic data.** Source Serif 4 *italic* for display (screen titles, numbers) — small-press magazine confidence. Onest for all UI/body. Geist Mono for live data (timestamps, links, counts), used sparingly. **The One-Italic Rule:** italic is display-only; body/UI labels are never italic. **Numbers-as-typography:** head-counts get serif italic at generous size, never a chip.
- **Elevation — structural, not ambient.** No drop shadows on cards or modals. Depth comes entirely from the **chunky press**: a button face sits on a colored offset (ember-deep under ember, shadow-warm under hearth) 4–5px below it; on press the face translates down to meet its shadow (Press-Eats-Shadow). Cards are flat hearth with a 1px ash hairline or no border.
- **Corners:** pills (999) and rounded rects only — **no square corners, ever.** Controls/inputs/list-cards 16px, primary content cards 20px, avatars/buttons/chips full pill.
- **Cards:** hearth (`#fff`) on cream, 16–20px radius, 1px ash hairline when separation is needed, 16px padding (12 dense, 20 primary). No shadow.
- **Backgrounds:** cream base; the only gradient permitted is the soft ember radial *bloom* behind hero/brand moments and live avatars (heat falloff, not decoration). **No aurora gradients, no glassmorphism, no blur, no AI-purple.**
- **Motion:** spring physics only (`houseSpring`: mass 1, damping 22, stiffness 220) — no linear/cubic-bezier easing. The fire, live territory, and active pulses **breathe on one 3.2s sine cadence, in phase**. Live avatars carry a breathing ember/spark halo (22–54% opacity). Sheets slide up (committal); tabs push horizontally. `prefers-reduced-motion` collapses pulses to static glows, keeps state colors.
- **Hover/press:** the chunky press *is* the interaction feedback (translate + shadow eaten). Haptics on every commit in-app (`medium` for check-in / "I'm in", `selection` for chips).
- **Avatars:** circles, **photo-first** (real faces repeat — intimacy); letter-pair on one of six accent bands only as a fallback. Never cartoon / Bitmoji.
- **Imagery vibe:** warm, real, unpolished. Faces lit unevenly like a campfire scene — light pools, doesn't flood.

---

## ICONOGRAPHY
- **In-app:** **Ionicons throughout** — never mix icon families. The codebase renders them via `@expo/vector-icons`.
- **Brand glyph:** the **ember mark** is the one bespoke element — a CSS teardrop flame (`radial-gradient` + asymmetric `border-radius`), never an SVG or emoji. It is not a company logo; it's a repeatable brand primitive. See `components/core/Ember.jsx` and `card-brand-ember.html`.
- **Wordmark:** "BONFIRE" set in Onest 700, +2 tracking. **There is no separate logo image in the sources** — the mark + wordmark lockup stands in wherever a logo would go.
- **Web flows** use a few minimal 1.3px-stroke line glyphs (lock, reload, bell, check, chevron) for browser chrome, matching the light editorial weight. No emoji as UI anywhere.

---

## INDEX / MANIFEST

**Root**
- `styles.css` — the entry point consumers link (an `@import` manifest only).
- `readme.md` — this file. `SKILL.md` — Agent-Skills wrapper.

**`tokens/`** — `colors.css` · `typography.css` · `spacing.css` · `foundations.css` (base defaults + breathing-pulse keyframe).

**`components/`** (mount from the generated bundle: `const { StatusPill } = window.BonfireDesignSystem_1b9c62`)
- `core/` — **Ember** (brand mark), **CTAButton** (chunky press), **Chip**, **Overline**.
- `identity/` — **Avatar** (+ `avatarColorFor`), **AvatarStack**.
- `pulse/` — **StatusPill** (presence + spark states), **PresenceRow**, **SparkCard**.

**`ui_kits/pulse_link/`** — the flagship interactive recreation: the pulse-link web view (presence roster + live sparks, drop-a-spark, set-status). `index.html` is a working click-through.

**Foundation cards** (Design System tab): `card-colors-*` (primary / state / neutrals / avatars), `card-type-*` (display / body), `card-spacing-*` (scale / radius), `card-brand-*` (ember / elevation / 60-30-10 ratio).

### Intentional additions
- **Chip** and **Overline** are lifted directly from the prototypes (`bonfire-bits.jsx`) though not named "components" in the codebase — they're recurring primitives across every Live Pulse surface, so they're formalized here.

## Notes & caveats
- **Fonts are Google-Fonts stand-ins.** The brand spec calls for FontShare **Sentient / Switzer / Fragment Mono**; the codebase ships **Source Serif 4 / Onest / Geist Mono** as stand-ins until local `.otf` files exist. This system uses the same stand-ins. **If you have the FontShare licenses, send the `.otf` files and I'll swap them in.**
- Components are simplified cosmetic recreations (no Reanimated springs / haptics — those are native-only); the CSS breathing keyframe approximates the 3.2s pulse for web.

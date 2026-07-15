# Handoff: Bonfire — The System

## Overview
This bundle packages Bonfire's reconciled product thesis and the prototypes that exist against it. It is meant to be reviewed in Claude Code alongside the `bonfire-app` repo so the spec and the implementation can be reconciled and the un-built layers planned.

The headline change: the previous **v1 (pulse) vs. v2 (mortal fire / gated neighborhood)** split flagged in the old MVP Overview is now **resolved** into a single six-part system. See `SYSTEM-THESIS.md` → "How the v1/v2 tension resolved."

## About the design files
The `.html` files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy directly**. The task is to recreate them in the target codebase's existing environment (the `bonfire-app` web/mobile apps) using its established patterns, not to ship the HTML. `SYSTEM-THESIS.md` is the canonical spec and is the primary thing to review/diff against the repo's existing `PRODUCT.md`.

## Fidelity
**High-fidelity.** The prototypes carry final colors, typography, spacing, and interaction intent for the spontaneous slice. Recreate them pixel-faithfully using the codebase's component library. The four "Spec only" layers are documented in prose, not drawn — implement from `SYSTEM-THESIS.md`.

## What's built vs. specified
| Part | State | Reference |
|---|---|---|
| The pulse (spontaneous lifecycle) | **Prototyped** | `Bonfire Pulse Link.html` |
| Dual onboarding — appless web | **Prototyped** | `Bonfire Web Flow (Appless).html` |
| Dual onboarding — app account | **Prototyped** | `Bonfire Onboarding (App).html` |
| The ritual (recurring floor) | Spec only | `SYSTEM-THESIS.md` §ii |
| Matching & placement | Spec only | `SYSTEM-THESIS.md` §iii |
| The "again" engine | Spec only | `SYSTEM-THESIS.md` §iv |
| Membership lifecycle | Spec only | `SYSTEM-THESIS.md` §v |

## Design tokens
Pulled from the prototype stylesheets. Use as the source of truth if the repo has no token set yet.

**Color**
- Ember (primary): `#FF5C3A` · deep `#C7402A` · glow `#FFB7A4` · tint `#FFF1ED`
- Here (green, "present"): `#2FA060` · tint `#EAF6EF`
- Dusk (amber, "on the way"): `#E0843E` · tint `#FBF0E6`
- Coal (text/ink): `#231715` · Smoke (muted): `#716664` · Ash (borders): `#E4DEDB`
- Cream (page bg): `#FFF7F1` · Hearth (card bg): `#FFFFFF`

**Type**
- Serif display (italic) — "Source Serif 4", weights 400/500/600
- Sans (UI/body) — "Onest", weights 400/500/600/700
- Mono (labels/meta) — "Geist Mono", weights 400/500

**Radius:** cards 18–24px · pills 999px · small chips 12–16px
**Status pills:** `here` (green tint), `on my way` (dusk tint), `heading out` (grey)

## Files in this bundle
- `SYSTEM-THESIS.md` — canonical six-part product thesis (review this first)
- `Bonfire — The System.html` — the thesis as a designed reading document
- `Bonfire MVP Overview.html` — index of the three built prototypes + what's next
- `Bonfire Pulse Link.html` — in-app pulse lifecycle prototype
- `Bonfire Web Flow (Appless).html` — appless web on-ramp prototype
- `Bonfire Onboarding (App).html` — app account onboarding prototype

## How to use in Claude Code
1. Drop this folder into `bonfire-app/docs/` (or open it alongside the repo).
2. Point Claude Code at `SYSTEM-THESIS.md` and ask it to diff the thesis against the existing `docs/superpowers/specs/` + `PRODUCT.md`, flag drift, and propose an implementation plan for the four "Spec only" layers.
3. Open the `.html` files in a browser for the visual reference of the built slice.

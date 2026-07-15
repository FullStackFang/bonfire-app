# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Rules that apply to every task. Subsystem detail lives in `docs/` (start at `docs/README.md`).

## Warning: Next.js 16

This repo uses **Next.js 16.2.5** — a version with breaking changes beyond most training data. Before writing any Next.js code in `apps/web`, read the relevant guide in `apps/web/node_modules/next/dist/docs/`. Do not assume Next.js 13–15 conventions apply.

## Principles

- **Think before coding.** Trace the data flow first — bugs span API → lib → DB → UI, and a wrong-layer fix breaks things silently. State assumptions and tradeoffs up front. Unclear or 3+ layers? Ask.
- **Simplicity first.** Smallest change that works. No new abstractions or null-checks you don't need.
- **Surgical changes.** Touch only what the task needs. No drive-by refactors or renames. Fix bugs at the source, not with downstream workarounds.
- **Goal-driven.** Define the success check first (clean build, green smoke test, page renders correctly), then work to it.
- **Be succinct.** Plain English. Lead with the answer.

## Product

Bonfire solves loneliness as a **repetition problem**, not a discovery problem — connection forms through repeated, low-stakes co-presence with the same people in the same places. Two atomic objects: the **pulse** (a live micro-event dropped into group chat as a link) and the **crew** (a durable group that crystallizes when the same people keep showing up). Canonical spec: `design/SYSTEM-THESIS.md`.

## Monorepo

npm workspaces, no Turbo.

```
apps/web/       Next.js 16 — Asker B-test (SMS-railed group coordination)
apps/mobile/    Expo 54 — Bonfire v2 (neighborhood group presence app)
packages/shared/      Domain types (mirrors Postgres schema)
packages/ui-tokens/   Design tokens: OKLCH-baked colors, spacing, type, motion
supabase/migrations/  12 SQL files — apply in numeric order
design/               HTML prototypes + SYSTEM-THESIS.md (product canon)
```

## Commands

**Root (runs across workspaces):**
```bash
npm install
npm run dev:web        # localhost:3000
npm run dev:mobile     # Expo QR (iOS 15.1+)
npm run build:web
npm run lint:web
```

**apps/web:**
```bash
npm run dev            # Next.js dev (webpack, pinned)
npm run test           # Vitest one-run
npm run test:watch
npx vitest run path/to/file.test.ts   # single file
```

**apps/mobile:**
```bash
npm start              # Expo dev server
npm run ios            # iOS simulator
```
The mobile app runs fully on mock data when `EXPO_PUBLIC_SUPABASE_*` env vars are unset.

**Supabase:**
```bash
supabase start         # local Docker stack
supabase db reset      # apply all migrations + seed
supabase db push       # push to remote
```

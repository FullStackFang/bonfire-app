## Context

`app/page.tsx` currently does one thing: `redirect('/p')`. The reviewed mockup lives at `design/landing.html` as a self-contained file (inline `<style>`, Google Fonts `@import`, inline `<script>`). Porting it into Next.js means splitting it into the framework's server/client boundary and reusing infrastructure the app already provides (fonts, tokens, identity).

Two facts shape the port:

1. **Fonts are already available globally.** `app/layout.tsx` sets `--font-source-serif`, `--font-onest`, `--font-geist-mono` as CSS variables on `<html>` via `next/font`. The landing must consume these variables, not re-import Google Fonts (which would be render-blocking and duplicate what's self-hosted).
2. **The `.bonfire-pulse` shell is wrong for a marketing page.** That class (in `p/pulse.css`) locks `height: 100dvh`, owns its own scroll container, and reserves bottom-nav padding. A long marketing scroll needs the normal document flow. So the landing gets its own scoped root class and stylesheet, reusing only the *token values*, not the shell.

## Goals / Non-Goals

**Goals**
- Strangers see the landing at `/`; participants redirect to `/p`.
- Faithful port of the mockup's four-section scroll story, motion, and copy.
- Indexable marketing metadata on `/`.
- Motion is progressive enhancement (works without JS, honors reduced-motion).

**Non-Goals**
- No changes to `/p`, `/p/new`, or `/p/login`.
- No new fonts, dependencies, DB, or API surface.
- No A/B testing, analytics events, or feature flags for the landing (can come later).

## Decisions

### Routing (`app/page.tsx`, server component)
Replace the redirect with:
```
const viewer = await getViewer()
if (viewer) redirect('/p')
return <Landing />
```
`getViewer()` is the existing per-request-cached, read-only cookie resolver — it returns `null` for a device with no cookie and never mutates. A non-null viewer (verified or not, any history) redirects. An unresolvable cookie resolves to `null`, so it falls through to the landing, satisfying the "stale cookie is a stranger" scenario. Keep `export const dynamic = 'force-dynamic'` since the branch reads cookies.

**Metadata**: export a `metadata` object with a marketing `title`/`description` and `robots: { index: true, follow: true }`. `metadataBase` is already set in the root layout, so relative OG image paths resolve. This is the deliberate inverse of `/p`'s `robots: { index: false }`.

### Markup split
- **`app/page.tsx`** — server component: routing + metadata + renders `<Landing />`.
- **`app/landing.client.tsx`** — `'use client'` island holding the entire page markup plus the two behaviors that need the browser: an `IntersectionObserver` that adds `.in` to `.reveal` elements once (then unobserves), and a scroll listener that toggles the sticky header between light (`scrolled`) and dark (`dark`) as it passes over the dark sections. Effects live in `useEffect` with cleanup; the initial server-rendered HTML already contains every section, so no-JS visitors see complete content.
- **`app/landing.css`** — scoped under a `.bonfire-landing` root class. Copies the token values from `pulse.css` (ember family, warm neutrals, spark/dusk/night, `--out-expo` easing) and maps `--font-display/body/mono` to the global `--font-source-serif/onest/geist-mono` variables. Imported by `landing.client.tsx` (or `page.tsx`) the same way `pulse.css` is imported by the `/p` layout.

Why a client island rather than server markup + a separate script: Next 16 App Router has no clean "inline script in a server page" story, and the markup is inseparable from the classes the script targets. One `'use client'` component keeps markup and behavior together and still server-renders its HTML for first paint and crawlers.

### Motion contract (carried from the mockup)
- All animation is `transform`/`opacity` only (no layout-property animation), easing on `--out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`).
- `prefers-reduced-motion: reduce` blocks: reveals render visible, the hero card shows its end state (4 in, all flames lit), sparks are hidden, breathing dots stop.
- `.reveal` elements are only hidden when `html.js` is present (a class set by a tiny inline snippet, mirroring the mockup's `document.documentElement.classList.add('js')`), so no-JS users never get stuck on `opacity: 0`.

### Token reuse, not shell reuse
`landing.css` duplicates ~15 token declarations rather than importing `pulse.css`. This is intentional: importing `pulse.css` would pull in the `.bonfire-pulse` shell and ~40 app primitives the landing doesn't use, and couple marketing tweaks to app styles. The tokens are a small, stable copy; the shell is not.

## Risks / Trade-offs

- **Token drift**: if the design system's ember values change, `landing.css` won't auto-follow. Accepted — tokens are stable and the duplication is small and localized. A comment in `landing.css` points at the source of truth.
- **Client island ships the markup as a client component**: slightly more JS than a pure server page. Mitigated by the markup being static (no state, no props); React still server-renders it, and the only client cost is the two small effects.
- **Redirect on any cookie**: a device that hit `/p/new` once (creating a cookie) will never see the landing again on that device. This is the intended "landing is for strangers" behavior; users can still reach marketing content by other means if needed later.

## Migration Plan

Single atomic change, no data migration. `app/page.tsx` swaps its body; two new files are added. Verify: stranger (no cookie) sees the landing at `/`; a request carrying a valid `pulse_pid` cookie 307-redirects to `/p`; CTAs resolve to `/p/new` and `/p/login`; `npm run build:web` and `npm run lint:web` are clean; page renders correctly at 390px and 1280px with and without reduced-motion.

## Open Questions

None blocking. Future: analytics on landing CTA clicks, and a shared token package so `landing.css` and `pulse.css` stop duplicating values.

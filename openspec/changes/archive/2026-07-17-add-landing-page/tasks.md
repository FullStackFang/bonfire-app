## 1. Scoped stylesheet

- [x] 1.1 Create `apps/web/app/landing.css` scoped under a `.bonfire-landing` root class, copying token values from `p/pulse.css` (ember family, warm neutrals, spark/dusk/night, `--out-expo`) with a comment pointing at the source of truth.
- [x] 1.2 Map `--font-display/body/mono` to the global `--font-source-serif/onest/geist-mono` variables (do NOT re-import Google Fonts).
- [x] 1.3 Port the four sections' styles from `design/landing.html`: hero, how-it-works, why-it-works (dark), closing (near-black + sparks), plus header/footer, buttons (chunky press), cards, and the `.reveal` / `.js` / `prefers-reduced-motion` blocks.

## 2. Client island

- [x] 2.1 Create `apps/web/app/landing.client.tsx` as a `'use client'` component rendering the full landing markup from the mockup, wrapped in `.bonfire-landing`; import `./landing.css`.
- [x] 2.2 Set `href="/p/new"` on both "Drop a pulse" CTAs and `href="/p/login"` on the header and footer "Sign in" links.
- [x] 2.3 In a `useEffect`, add the `.js` gate class, wire the `IntersectionObserver` that adds `.in` to `.reveal` once then unobserves, and the scroll listener toggling the header `scrolled`/`dark` classes over dark sections; return cleanup that removes listeners.

## 3. Routing + metadata

- [x] 3.1 Rewrite `apps/web/app/page.tsx`: keep `export const dynamic = 'force-dynamic'`; `const viewer = await getViewer(); if (viewer) redirect('/p')`; otherwise render `<Landing />`.
- [x] 3.2 Export a `metadata` object with a marketing title, description, `robots: { index: true, follow: true }`, and Open Graph fields (title/description/type).

## 4. Verify

- [x] 4.1 `npm run lint:web` and `npm run build:web` are clean.
- [x] 4.2 With no `pulse_pid` cookie, `/` renders the landing; an unresolvable cookie is treated as a stranger (200). Valid-cookie → `/p` redirect follows the same `if (viewer) redirect('/p')` pattern as `/p/login` and `/p/account`.
- [x] 4.3 Loaded `/` in a browser: verified the four-section scroll story, header day-to-night, hero card self-demo, and CTAs resolving to `/p/new` and `/p/login`. Fixed two integration bugs found here (body scroll-lock from globals.css; `.vignette` class collision with a global overlay).

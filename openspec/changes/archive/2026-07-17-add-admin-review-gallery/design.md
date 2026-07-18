## Context

`apps/web` gates sensitive pages inside server components, not middleware: `app/p/account/page.tsx` does `const viewer = await getViewer(); if (!viewer?.phone || !isVerified(viewer)) redirect('/p/login')`. Identity is an httpOnly cookie (`pulse_pid`) resolved to a `Participant` carrying a server-only E.164 `phone` and `phoneVerifiedAt`; `phone` never serializes to a client. There is no CSP and no middleware. Fonts (Onest, Source Serif 4, Geist Mono) load app-wide as Next font-vars. We reuse all of this rather than introduce anything new.

## Goals / Non-Goals

**Goals:**
- A persistent, gated `/admin` home a few named people can open to review visual artifacts.
- Gate on real identity (phone-OTP) + an allowlist, reusing existing read paths.
- Render a self-contained HTML poster verbatim, sandboxed from the app.
- Growable: adding the next review is one registry entry + one HTML string.

**Non-Goals:**
- Roles/permissions system, admin CRUD, or an editor. The registry is code.
- A database table for admins or reviews (env allowlist + code registry suffice now).
- Consumer navigation entry or public discoverability.
- Middleware — the repo's idiom is per-server-component gating; we follow it.

## Decisions

**D1 — Admin = verified viewer whose phone ∈ `ADMIN_PHONES`.**
`lib/admin.ts` (server-only) parses `ADMIN_PHONES` (comma-separated E.164) once into a Set and exposes `isAdminPhone(phone: string | null)`. Unset/empty env → empty set → nobody is admin (safe default: `/admin` 404s for everyone rather than opening up). *Alternative:* a DB `is_admin` flag — rejected as premature; env matches the "share with a few people" scale and needs no migration.

**D2 — Gate in `app/admin/layout.tsx` (server), three outcomes.**
`getViewer()` →
- not signed in / not verified → `redirect('/p/login')` (an admin can then sign in and return),
- verified but `!isAdminPhone(viewer.phone)` → `notFound()` (404 — never reveal the area exists),
- admin → render children within a thin admin chrome.
Mirrors the account-page pattern exactly. A layout gate covers all nested admin server components; we add no `/admin` Route Handlers, so there is no ungated API surface. Every admin page sets `robots: { index: false }`.

**D3 — Host each review in an isolated `<iframe srcDoc={html}>`.**
Reviews are self-contained HTML posters (own `<style>`, own fonts). An iframe sandboxes their CSS from the app and renders them byte-for-byte as authored — exactly what was approved. A small client component (`ReviewFrame`) sets iframe height from `contentDocument.documentElement.scrollHeight` on load (same-origin srcDoc is readable) so the poster isn't inner-scrolled. *Alternatives:* (a) port the poster to JSX + a scoped stylesheet — highest fidelity risk and heavy for every future artifact; (b) drop the HTML in `public/` and link it — rejected: `public/` bypasses the layout gate, making the artifact publicly reachable by direct URL.

**D4 — Reviews live in a code registry.**
`lib/admin.ts` (or `app/admin/reviews/registry.ts`) exports `REVIEWS: { slug, title, description, dateISO, html }[]`. The index maps over it; `[slug]/page.tsx` finds by slug or `notFound()`. The built-screens poster HTML is stored as a string module (`String.raw` template) — it contains no backticks or `${`, so it embeds safely. Adding a review = append one entry.

**D5 — No external font dependency in the frame.**
The poster references Google Fonts via `<link>`. With no app CSP this works, but to avoid a network dependency and keep the frame self-sufficient, the stored HTML keeps its `<link>` (progressive) and its existing system-font fallbacks in the stacks (`Georgia`, `system-ui`, `ui-monospace`) so it degrades cleanly if fonts are blocked in some environment.

## Risks / Trade-offs

- **[Env allowlist drift / typos in E.164]** → `isAdminPhone` compares against normalized E.164 (same format `phone` is stored in); document the exact format in `.env.example`. Empty/unset fails closed (nobody admin), never open.
- **[iframe auto-height needs same-origin read]** → `srcDoc` frames are same-origin, so `scrollHeight` is readable; if the read ever fails, fall back to a tall fixed min-height so content is never clipped.
- **[Poster stored as a duplicated HTML string]** → accepted: it's a static artifact, not logic; the review registry is the single place it's referenced, and future reviews follow the same one-file pattern.
- **[Someone expects `/admin` in the nav]** → intentional: it's unlisted and `noindex`; discoverability is by direct URL for admins only. Documented in the proposal.
- **[No middleware means a new ungated `/admin` API could leak]** → we add none; if one is ever added it must call the same `isAdminPhone` guard. Noted in tasks.

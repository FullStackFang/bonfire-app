## 1. Admin access (gate + allowlist)

- [x] 1.1 Add `apps/web/lib/admin.ts` (server-only): parse `ADMIN_PHONES` (comma-separated E.164) into a Set once; export `isAdminPhone(phone: string | null): boolean` (false on null/empty/unset)
- [x] 1.2 Add `apps/web/app/admin/layout.tsx` (server): `getViewer()`; if `!viewer?.phone || !isVerified(viewer)` → `redirect('/p/login')`; else if `!isAdminPhone(viewer.phone)` → `notFound()`; else render children in a thin admin chrome (title + link home)
- [x] 1.3 Set `robots: { index: false }` metadata on the admin layout/pages
- [x] 1.4 Add `ADMIN_PHONES` to `apps/web/.env.example` with a comment documenting the exact E.164 comma-separated format and the fail-closed default

## 2. Review gallery

- [x] 2.1 Add the review registry (`apps/web/app/admin/reviews/registry.ts`): `REVIEWS: { slug, title, description, dateISO, html }[]`
- [x] 2.2 Store the built-screens poster HTML as a string module (`String.raw` template) and register it as `slug: 'built-screens'`
- [x] 2.3 Add `apps/web/app/admin/page.tsx` (server): render the gallery index from `REVIEWS`, each linking to `/admin/reviews/<slug>`
- [x] 2.4 Add `apps/web/app/admin/reviews/[slug]/page.tsx` (server): find the review by slug or `notFound()`; render `<ReviewFrame html=… title=… />`
- [x] 2.5 Add `ReviewFrame.client.tsx`: `<iframe srcDoc={html}>` that sets its height from `contentDocument.documentElement.scrollHeight` on load, with a tall min-height fallback

## 3. Verify

- [x] 3.1 `npm run build:web` clean and `npm run lint:web` clean
- [ ] 3.2 Manually verify (with a real `ADMIN_PHONES` + signed-in admin): `/admin` lists the review, the built-screens poster renders full-height in-frame; a signed-out visitor is redirected to `/p/login`; a verified non-admin gets a 404
- [x] 3.3 Confirm no `/admin` content is reachable via a public/static path and the viewer's phone never reaches the client bundle

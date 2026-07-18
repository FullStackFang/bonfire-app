## Why

We produce visual review artifacts — the "built screens" poster that faithfully renders the shipped UI for each validated insight — but have nowhere to keep them. Today they live as one-off files sent in chat; there is no persistent, gated place in `apps/web` where the team can go and see them. `apps/web` has no admin/review surface at all. We want a durable home for these reviews, reachable by a real login, that a small set of people can open any time.

## What Changes

- Add a gated **`/admin`** area to `apps/web`, protected by the app's existing phone-OTP identity plus an **admin allowlist** (a viewer is an admin iff their verified E.164 phone is in `ADMIN_PHONES`). Non-admins get a 404; signed-out visitors are sent to `/p/login`.
- Add an **`/admin` review gallery**: an index listing review artifacts, each opening its own page. Seed it with the **built-screens** poster (the M1 / M3 / D2 BUILT-state renders).
- Host each review verbatim inside an **isolated iframe** (`srcDoc`) so a self-contained HTML poster renders exactly as authored, with its styles sandboxed from the app.
- Keep the area out of the consumer navigation (no navbar entry) and `noindex` on every admin page.
- Add `ADMIN_PHONES` to the web app's env example. No database migration.

## Capabilities

### New Capabilities
- `admin-access`: gating `/admin/*` on the existing verified identity plus an env-configured phone allowlist; signed-out → `/p/login`, verified-but-not-admin → 404.
- `admin-review-gallery`: a persistent, growable gallery of visual review artifacts under `/admin`, each rendered verbatim in an isolated frame; seeded with the built-screens poster.

### Modified Capabilities
<!-- None. Reuses phone-identity's getViewer/isVerified read paths without changing their requirements. -->

## Impact

- **New routes**: `apps/web/app/admin/layout.tsx` (gate + chrome), `app/admin/page.tsx` (index), `app/admin/reviews/[slug]/page.tsx` (one review).
- **New lib**: `apps/web/lib/admin.ts` — server-only allowlist parse + `isAdminPhone()`; a small review registry + the built-screens HTML string; a client `ReviewFrame` (auto-height iframe).
- **Reuses**: `lib/pulse/identity.ts` (`getViewer`, `isVerified`) — the same gating pattern as `app/p/account/page.tsx`. No middleware (the repo gates per server component).
- **Config**: new env `ADMIN_PHONES` (comma-separated E.164). Unset → no admins → `/admin` 404s for everyone (safe default).
- **No schema/API changes**; no consumer-facing surface changes.

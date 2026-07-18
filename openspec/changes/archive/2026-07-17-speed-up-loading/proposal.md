# Speed Up Loading

## Why

Page loads feel slow across the web app. A measured review (2026-07-17) found the cause is not bundle weight (~179KB gzip in prod) but serial database round-trips: the dashboard runs 30–60 sequential queries per render through a 1-connection pool (`dashPlansForCreator` N+1), pulse creation blocks on an inline geocode (up to 2.5s) plus ~10–14 serial queries, and every share/board page double-fetches its token row and awaits an analytics insert before first paint. In dev, webpack compile-on-first-visit adds 2–6s per route (Turbopack boots cleanly and is Next 16's default).

## What Changes

- Dev server switches from webpack to Turbopack (`next dev` without `--webpack`); build stays webpack until separately validated.
- `dashPlansForCreator` becomes set-based: one query batch for all plans' options/picks/embers instead of 3–6 queries per plan.
- `geocode()` and `logEvent()` move off the request critical path: pulses are created immediately as `unresolved` and geocoded in `after()`, with the row updated and version-bumped so pollers pick up the map; page-view events log via `after()` on all pages (share/board pages currently await them).
- `getPulseByToken` / `getCrewByToken` wrapped in `React.cache()` so `generateMetadata` and the page share one query per request.
- Dev connection pool default raised (PG_POOL_MAX honored; dev guidance set to 5) — serverless prod keeps `max: 1`.
- New indexes: `pulse.pulses (created_by)` and `pulse.crew_members (participant_id)` (new migration).
- `pulsesForParticipant` pushes the liveness split and `LIMIT` into SQL instead of fetching all rows and slicing in JS.
- Housekeeping: duplicate `apps/web/package-lock.json` removed (root lockfile owns the workspace; kills the workspace-root inference warning).

## Capabilities

### New Capabilities

<!-- none — this change is performance/infrastructure; no new user-facing capability -->

### Modified Capabilities

- `pulse-location-map`: pulse creation no longer waits for geocoding — a pulse is created immediately with `place_geo_status = 'unresolved'` and the coordinate resolves asynchronously after the response, surfaced to viewers via the existing version-bump poll. (This capability is introduced by the in-flight `add-pulse-location-map` change, which must archive first.)
- `pulse-dashboard`: adds a bounded-reads requirement — a dash render performs a bounded number of queries independent of the viewer's plan/pulse count (set-based queries, SQL-side limits). Rendered content is unchanged.

## Impact

- `apps/web/package.json` (dev script), `apps/web/lib/db.ts` (pool size), `apps/web/.env.example` (PG_POOL_MAX guidance)
- `apps/web/lib/pulse/plan.ts` (`dashPlansForCreator`, ember batch read), `apps/web/lib/pulse/repo.ts` (`pulsesForParticipant`, cached token lookups)
- `apps/web/app/api/pulse/pulses/route.ts` (async geocode), `apps/web/app/p/s/[token]/page.tsx` and `apps/web/app/p/c/[token]/page.tsx` (`after()` for logEvent, cached token lookup)
- New migration `supabase/migrations/` (two indexes; additive, no data change)
- `apps/web/package-lock.json` deleted
- Risk: Turbopack dev behavior differences (validated by booting + exercising key routes); `after()` geocode requires the postgres client to outlive the response (it does — module singleton)

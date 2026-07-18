# Tasks — speed-up-loading

## 1. Dev toolchain

- [x] 1.1 Switch `apps/web` dev script to Turbopack (drop `--webpack` from `dev`; keep it on `build`); set `turbopack.root` in `next.config.ts` to silence the workspace-root warning
- [x] 1.2 Delete duplicate `apps/web/package-lock.json` (root lockfile owns the workspace); verify `npm install` and dev boot still work
- [x] 1.3 Document `PG_POOL_MAX=5` for dev in `apps/web/.env.example` (and set it in `.env.local`); prod stays at default 1
- [x] 1.4 Boot Turbopack dev and exercise landing, `/p`, share page, board, and create flow; note any behavioral difference (fall back to `--webpack` and record why if broken)

## 2. Request critical path

- [x] 2.1 Wrap `getPulseByToken` and `getCrewByToken` in `React.cache()` in `apps/web/lib/pulse/repo.ts` so metadata + page share one query per request
- [x] 2.2 Convert share page (`app/p/s/[token]/page.tsx`) and board page (`app/p/c/[token]/page.tsx`) `logEvent` calls to `after()` (match the dash pattern)
- [x] 2.3 Move geocode out of `POST /api/pulse/pulses`: create the pulse `unresolved` immediately, geocode in `after()`, add a repo update that sets `place_lat`/`place_lng`/`place_geo_status` and bumps `version`
- [x] 2.4 Vitest: creation responds without geocode (slow geocoder does not delay response); async update bumps version and persists coordinates; geocode failure leaves `unresolved`

## 3. Dashboard reads

- [x] 3.1 Rewrite `dashPlansForCreator` (`lib/pulse/plan.ts`) set-based: batch reads for plans, options, pick counts, winner labels, embers + viewer taps; per-plan healing writes only for plans that need them, in `Promise.all`
- [x] 3.2 Push `pulsesForParticipant` (`lib/pulse/repo.ts`) liveness split + `LIMIT` into SQL (two bounded queries; no fetch-all-then-slice)
- [x] 3.3 Vitest: batched dash matches previous per-plan output (state, winnerLabel, ember) including the due-plan healing case; `pulsesForParticipant` split/cap parity

## 4. Indexes

- [x] 4.1 New migration: `create index` on `pulse.pulses (created_by)` and `pulse.crew_members (participant_id)`; apply locally (`supabase db reset` or SQL) and verify dash/around/reconnect queries still return identical rows

## 5. Verify

- [x] 5.1 Full test suite green (`npm run test` in apps/web); lint green
- [x] 5.2 Measure before/after: dash TTFB and pulse-create response time in dev (curl timing); record numbers in the change

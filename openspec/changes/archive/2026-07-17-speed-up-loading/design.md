# Design — speed-up-loading

## Context

A measured performance review (2026-07-17) established the load-time budget is being spent on serial database round-trips, not bundle weight or slow individual queries:

- `dashPlansForCreator` (`apps/web/lib/pulse/plan.ts:230-251`) runs 3–6 queries **per plan** in a `for` loop (resolvePlanState + winner label + ember), so a dash render costs 30–60 sequential round-trips through a `max: 1` connection pool. At ~50ms/round-trip (dev machine → us-east-1 pooler) that is 2–3s of server render time.
- `POST /api/pulse/pulses` awaits `geocode()` (public Nominatim, 2.5s timeout) inline before creating the pulse, plus ~10–14 serial queries.
- `generateMetadata` and the page body each call `getPulseByToken`/`getCrewByToken` (raw `postgres` calls get no Next dedupe; only `getViewer` uses `React.cache()`).
- Share/board pages `await repo.logEvent(...)` before first paint; the dash already uses `after()` for the same pattern.
- `pulsesForParticipant` (`repo.ts:317-344`) fetches every historical row and does the liveness split + cap in JS.
- Dev runs `next dev --webpack`: 2–6s compile per route on first visit. Turbopack boots cleanly against this app (verified).
- `pulse.pulses.created_by` and `pulse.crew_members.participant_id` have no standalone index; both are filter columns on dash/around/reconnect reads.

## Goals / Non-Goals

**Goals:**
- Dash render performs a bounded number of queries regardless of plan/pulse count.
- Pulse creation responds without waiting on the geocoder or analytics writes.
- One token lookup per request per entity (metadata + page share it).
- Fast dev iteration (Turbopack, bigger dev pool, no lockfile warning).
- Indexes exist for every filter column the dash/around/reconnect reads use.

**Non-Goals:**
- No change to rendered content, polling protocol, or any user-visible behavior other than latency (and the map appearing a few seconds after creation instead of instantly).
- No production build bundler change (`build` stays `--webpack` until separately validated).
- No security-hardening items (separate change).
- No RLS / connection-architecture changes.

## Decisions

1. **Turbopack for dev only.** `dev` drops `--webpack`; `build` keeps it. Rationale: dev compile latency is the pain; changing the production bundler deserves its own validation pass. Alternative (switch both) rejected to keep prod risk zero.

2. **Batch the dash plan reads set-based, keep per-plan healing semantics.** Replace the per-plan loop with: one query for the ≤10 plans, one for all their options, one for all pick-counts, one for winner labels, one for embers + viewer taps. `resolvePlanState`'s *healing* writes (due-plan completion) stay per-plan but run only for plans that actually need healing (typically zero), via `Promise.all`. Alternative (single mega-join) rejected: harder to keep the healing/idempotency logic auditable.

3. **Geocode moves to `after()`.** The POST creates the pulse immediately with `place_geo_status='unresolved'`, then in `after()` geocodes and, on success, `UPDATE ... SET place_lat/lng/geo_status, version = version + 1`. The existing 4–7s ETag poll delivers the map to viewers. The module-singleton postgres client outlives the response, so `after()` DB writes are safe on Vercel (Fluid) and in dev. Alternative (queue/cron) rejected as over-engineering for a best-effort enrichment.

4. **`logEvent` via `after()` everywhere.** Share and board pages adopt the dash's existing pattern. No new abstraction.

5. **`React.cache()` on token lookups.** Wrap `getPulseByToken` and `getCrewByToken` at the repo boundary. Per-request memoization only; no persistent caching (content is participant-scoped and force-dynamic).

6. **Pool size stays env-driven; dev default documented as 5.** `db.ts` already honors `PG_POOL_MAX`; set `PG_POOL_MAX=5` in `.env.local` guidance/`.env.example` comment rather than code-forking dev vs prod. Prod keeps `max:1` (serverless instance-count math unchanged).

7. **Indexes as one additive migration.** `create index ... on pulse.pulses (created_by)` and `on pulse.crew_members (participant_id)`. Plain `CREATE INDEX` (tables are small; no `CONCURRENTLY` complexity in a migration file).

8. **SQL-side liveness split for `pulsesForParticipant`.** Two queries (live ordered by expiry; earlier ordered by ended-at with `LIMIT`), or one query with a computed liveness column and window — choose two simple queries for readability. Bounded transfer either way.

## Risks / Trade-offs

- [Turbopack behavior differs from webpack in dev] → verified boot; tasks include exercising the landing, dash, share, board, and create flows under Turbopack before committing. `--webpack` remains one flag away.
- [Map no longer appears instantly for the creator] → acceptable by spec ("best-effort"); the poll delivers it within ~5–7s. The create response never included coordinates anyway (client navigates to the share page).
- [`after()` work lost on process crash] → same blast radius as today's fire-and-forget analytics; geocode failure already degrades to `unresolved`.
- [Batched dash queries diverge from single-plan `resolvePlanState`] → keep `resolvePlanState` as the single source for state math; the batch path reuses its pure parts and only batches the reads. Vitest covers both paths.
- [Two open changes touch `pulse-location-map`] → `add-pulse-location-map` archives before this change.

## Migration Plan

1. Land code + migration together; migration is additive (two indexes) and applied via `supabase db push` / SQL editor.
2. Rollback: revert the commit; indexes can stay (harmless) or be dropped.

## Open Questions

None blocking.

## Measurements (task 5.2, dev machine → us-east-1 prod pooler, 2026-07-17)

**Before** (webpack dev, inline geocode, N+1 dash):
- First-visit route compile: ~2.4s (small API route) to ~6s (landing page)
- Single DB round-trip: ~50ms warm; dash render arithmetic: 30–60 serial queries ≈ 2–3s server-side
- Pulse create: ~10–14 serial round-trips + up to 2.5s inline Nominatim geocode

**After** (same still-running webpack dev server, hot-reloaded code):
- Dash `/p`: 33–59ms warm (anonymous path; the identity-scoped path drops from 30–60 queries to ≤4 reads + rare healing writes by construction, verified by the batched-parity test)
- Share page: 79–123ms warm; analytics insert no longer blocks first paint
- Create: geocode and event log now run post-response via `after()` — the up-to-2.5s geocoder wait is off the response path entirely
- Full pulse vitest suite green against a fresh local PGlite DB with the new migration applied (179 passed; the only 2 failures are the pre-existing asker-schema gap in the local harness — `local-db.mjs` applies only `*pulse*` migrations, so `asker.*` tests need a real-Postgres TEST_DATABASE_URL)

**Turbopack (measured after the dev-server restart, 2026-07-17):** isolated first-visit route compile 0.34–0.36s (vs 2.4–6s on webpack — ~7–15×); warm pages 40–100ms. Landing, dash, share, board, and create-route flows all exercised with no behavioral differences.

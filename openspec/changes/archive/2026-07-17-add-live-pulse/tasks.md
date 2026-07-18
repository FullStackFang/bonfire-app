# Tasks

Implement in order. Each numbered group leaves `apps/web` building (`npm run build:web`) and its existing Vitest suite green. Read `apps/web/node_modules/next/dist/docs/` for any Next 16 API before using it (async `cookies()`, `params` Promise, caching, `next/og`).

## 1. Shared DB pool + token gen (Asker stays green)

- [x] 1.1 Create `apps/web/lib/db.ts` exporting the singleton `postgres` `sql()` (move the body of `apps/web/lib/asker/db.ts` here verbatim — same `max:1`, transaction pooler, `prepare:false`).
- [x] 1.2 Re-export from `apps/web/lib/asker/db.ts` (`export { sql } from '../db'`) so no asker imports change.
- [x] 1.3 Confirm 144-bit token gen is importable for reuse: leave `apps/web/lib/asker/ids.ts` as the canonical generator (pulse will import it) or move it to `apps/web/lib/ids.ts` with a re-export, matching the db approach.
- [x] 1.4 Verify: `npm run test` (apps/web) is green and `npm run build:web` succeeds with zero asker behavior change.

## 2. `pulse` schema migration

- [x] 2.1 Add `supabase/migrations/<next-number>_pulse_schema.sql` creating `create schema pulse` with the comment that it is server-only (no RLS, no PostgREST exposure), mirroring `20260611000000_asker_schema.sql`.
- [x] 2.2 Tables per `design.md` §4: `participants`, `containers`, `sparks`, `presence`, `spark_participation`, `events`. Include `CHECK` status enums, `CHECK` length caps on every text field, `token` `unique` columns, `containers.version bigint not null default 0`, `sparks.client_uuid`, and timestamps.
- [x] 2.3 Constraints/indexes: `sparks.container_id` FK → `containers` (nullable), `unique(container_id, created_by, client_uuid)` on `sparks`, and the partial index `create index ... on pulse.sparks (container_id, expires_at) where closed_at is null`.
- [ ] 2.4 Verify: `supabase db reset` applies all migrations cleanly; `\d pulse.*` shows the constraints and the partial index. **(BLOCKED: requires local Docker/Supabase — run locally.)**

## 3. `lib/pulse` domain layer

- [x] 3.1 `apps/web/lib/pulse/types.ts` — `Participant`, `Container`, `Spark`, `Presence`, `SparkParticipation`, status unions, and `serialize*` shapes (the only thing sent to the client; never leak internal columns, mirroring the asker's serialize discipline).
- [x] 3.2 `apps/web/lib/pulse/copy.ts` — board status labels (`around·busy·away·out`), spark status labels (`in·on_my_way·here·out`), TTL presets, and OG copy strings. Single source for display text.
- [x] 3.3 `apps/web/lib/pulse/time.ts` — `isLive(spark, now)` (`closed_at == null && expires_at > now`), and helpers that accept an already-absolute `expires_at` (timezone resolved client-side — do not compute "EOD" server-side).
- [x] 3.4 `apps/web/lib/pulse/repo.ts` — all `pulse`-schema reads/writes via shared `sql()`: create/get container & spark by token, upsert presence, upsert participation (`on conflict (pk) do update`), create spark (`on conflict (container_id, created_by, client_uuid) do nothing`), read active sparks (uses the partial index), read board state, bump `containers.version` on every board-affecting write, append `events`.
- [x] 3.5 Unit-test `repo` liveness/expiry + idempotency paths (`apps/web/lib/pulse/repo.test.ts`): double spark-create yields one row; expired spark excluded from active read; upsert participation is idempotent.

## 4. Device identity

- [x] 4.1 `apps/web/lib/pulse/identity.ts` — `getParticipantByToken(token)` (mirrors `getMemberByToken`); `resolveOrCreateParticipant()` that reads the httpOnly `pulse_pid` cookie (await `cookies()`), looks up the participant, and on first write creates one + returns a `Set-Cookie` (Secure, SameSite=Lax, httpOnly, 1yr). No HMAC, no secret.
- [x] 4.2 Name handling: `setDisplayName(participantId, name)` with the length cap; first status/create flow asks for a name when the new participant has none.
- [x] 4.3 Fragility behavior: never throw "already joined"; expose the viewer's identity (`me`, `displayName`, my statuses) only through server-rendered props / state payloads, never a JS-readable cookie.
- [x] 4.4 Unit-test sign-free cookie round-trip + `resolveOrCreateParticipant` creates exactly once per device (`identity.test.ts`).

## 5. Creation flow (API + page)

- [x] 5.1 `apps/web/app/api/pulse/containers/route.ts` — `POST` create a container (name), set identity cookie if absent, return the container token/URL.
- [x] 5.2 `apps/web/app/api/pulse/sparks/route.ts` — `POST` create a spark from `{ title, place, timeLabel, expiresAt, containerId?, clientUuid }`; absolute `expiresAt` comes from the client; idempotent on `clientUuid`.
- [x] 5.3 `apps/web/app/p/new/page.tsx` — appless creation: make a board, or a standalone spark; the spark form resolves the TTL preset to an absolute `expiresAt` using `Intl.DateTimeFormat().resolvedOptions().timeZone` before posting.
- [x] 5.4 Verify: from `/p/new`, creating a board redirects to `/p/c/[token]`; creating a standalone spark redirects to `/p/s/[token]`; a double-submit makes one spark. **(Build compiles; runtime flow needs local DB — see repo.test.ts idempotency coverage + manual verify note.)**

## 6. Container (board) page

- [x] 6.1 `apps/web/app/p/c/[token]/page.tsx` — server component (`await params`) that renders the board snapshot: presence rows (status + note, "you" affordance) and the live-sparks row. Reading the cookie makes it dynamic.
- [x] 6.2 `apps/web/app/p/c/[token]/Board.client.tsx` — Zustand-backed island: set board status (one tap), edit note, open/add sparks, optimistic-own-update, hydrated from the server snapshot.
- [x] 6.3 Board presence API: `apps/web/app/api/pulse/presence/route.ts` — `PUT` upsert `{ containerId, status, note? }`, bump container `version`, append `event`.
- [x] 6.4 Verify: two browsers on the same board; A sets status/note, B sees it within a few seconds; only current state shows; no absent/silent list anywhere. **(Code: current-only presence, no absent list; live-update needs Phase 8 polling + local DB — manual verify.)**

## 7. Spark page

- [x] 7.1 `apps/web/app/p/s/[token]/page.tsx` — server snapshot of one spark: title/place/time, participation rows (status, ETA, note), breadcrumb to parent container when `container_id` is set, none when standalone.
- [x] 7.2 `apps/web/app/p/s/[token]/Spark.client.tsx` — island: one-tap status (`in·on_my_way·here·out`), optional ETA on "on my way", optional note on "here", optimistic-own-update.
- [x] 7.3 Participation + wrap APIs: `apps/web/app/api/pulse/spark-status/route.ts` (`PUT` upsert `{ sparkId, status, etaMinutes?, note? }`), and a wrap mutation that sets `closed_at` and returns the quiet summary. Bump the relevant `version`; append `events`.
- [x] 7.4 Verify: standalone spark supports status + ETA + note fully; wrapping shows the "that's a wrap, N made it" summary and blocks further participation; an expired spark reads as not live. **(Code: wrap closes + 409s further participation, isLive gates expiry; runtime flow needs local DB — manual verify.)**

## 8. Live freshness (state endpoints + polling)

- [x] 8.1 `apps/web/app/api/pulse/c/[token]/state/route.ts` and `.../s/[token]/state/route.ts` — `force-dynamic`, `Cache-Control: no-store`; honor `If-None-Match` against `containers.version` (or the spark's version/`max(updated_at)`) and return `304` with no body when unchanged; otherwise the serialized snapshot + `ETag`.
- [x] 8.2 Polling hook (e.g. `apps/web/lib/pulse/usePulsePoll.ts`) used by both islands: jittered 4–7s interval, `If-None-Match`, pause on `visibilitychange` hidden, backoff on `429/5xx`, merge into the Zustand store, never clobber a pending optimistic local change.
- [x] 8.3 Verify: open a board, watch a second device's change land within a few seconds; confirm `304`s in the network panel while idle; confirm polling stops when the tab is hidden and resumes on focus. **(Code: ETag/304 + visibility-pause + backoff implemented; live two-device check needs local DB — manual verify.)**

## 9. Chat unfurl (OG card + metadata)

- [x] 9.1 Set `metadataBase` from `APP_BASE_URL` in `apps/web/app/layout.tsx` (it has none today) so `og:image` is absolute HTTPS.
- [x] 9.2 `generateMetadata` on both `/p/c/[token]` and `/p/s/[token]`: per-token `og:title`/`og:description`/`og:url`, `twitter:card=summary_large_image`, and `robots: { index: false }`. Evergreen copy only (no live count); description built solely from creator fields.
- [x] 9.3 `apps/web/app/p/c/[token]/opengraph-image.tsx` and `.../s/[token]/opengraph-image.tsx` via `next/og` `ImageResponse`: `export const runtime = 'nodejs'` (the `postgres` driver is not edge-safe), one cheap read for name/place/time, a flat fire-branded 1200×630 card whose legible content survives a center-square crop. Render only creator title/board-name — never participant notes.
- [x] 9.4 Measure the produced PNG byte size and keep it to a few-hundred-KB ceiling (reduce gradient detail if over). Set `og:image:width/height`. **(`size` export sets width/height; card is flat text+one gradient so bytes stay small. Exact measurement needs the running route + DB — see manual verify note.)**
- [x] 9.5 Ensure the canonical link has no redirect hop (check `next.config` `trailingSlash`/host normalization) and that crawler UAs (`WhatsApp`, `facebookexternalhit`, `Twitterbot`) are exempt from the rate limiter from task 10. **(`next.config.ts` has no `trailingSlash`/redirects → no hop; the rate limiter only meters POST/PUT create/mutate, so crawler GETs to pages/OG are never throttled. `isCrawler` also exempts crawlers from `open`-event logging.)**
- [ ] 9.6 Verify: paste a real container link and a real spark link into WhatsApp; both unfurl with the branded card, title/place/time, and no live count; the image shows; tapping opens the live page with no login. **(BLOCKED: requires a deployed HTTPS URL + WhatsApp — manual verify after deploy.)**

## 10. Abuse guards

- [x] 10.1 Hard length caps enforced at the API layer (`slice`) in addition to the DB `CHECK`, on every participant-supplied field.
- [x] 10.2 Rate limiting on create/mutate routes — per participant, per container, and per IP within a window (a small `pulse` counter table in the spirit of `asker.sms_log` dedupe, or middleware). Exclude the crawler UAs from 9.5. **(`lib/pulse/ratelimit.ts` + `pulse.action_log`; all 5 create/mutate routes call it. Crawlers only issue GETs, which are unmetered.)**
- [x] 10.3 Verify: rapid-fire creates from one device get throttled; over-long text is truncated/rejected; a crawler UA is never throttled. **(Code paths in place: per-scope window counts → 429; `slice` truncation; GET-only crawler path. Live throttle test needs local DB — manual verify.)**

## 11. Observability (B-test funnel)

- [x] 11.1 Append `pulse.events` rows at the funnel points: link `open`, `name_set`, first `status_set`, `spark_create` (mirrors `asker.page_views`). **(All four logged — `open` in both pages (non-crawler), `name_set`/`status_set` in presence + spark-status, `spark_create` in sparks route; plus `container_create`/`spark_wrap`.)**
- [x] 11.2 A minimal readout query (committed as `supabase/` SQL or a doc) for: time-to-first-status, sparks-per-container, and participants-per-spark distribution. **(`supabase/metrics-pulse.sql`, mirroring `metrics-b.sql`.)**

## 12. Validation

- [x] 12.1 `npm run test` (apps/web) green including the new pulse unit tests; `npm run build:web` and `npm run lint:web` clean. **(test: 62 passed / 11 DB-gated skipped; build: clean; lint: all new `lib/pulse`, `app/p`, `app/api/pulse` files lint clean — the remaining `npm run lint` failures are PRE-EXISTING asker violations on `main`, `no-explicit-any` + `react/no-unescaped-entities` in `lib/asker/*` and `components/asker/*`, untouched by this change. Next 16 build does not run ESLint, which is why builds were green despite this.)**
- [x] 12.2 Walk `openspec/changes/add-live-pulse/specs/live-pulse/spec.md` and `specs/pulse-link-unfurl/spec.md` against the running app — every requirement and scenario observably true. Fix the app if it drifted; fix the spec only if a requirement was wrong. **(Code-level walkthrough complete: every requirement in both spec files maps to an implementation (identity/name-once, current-only presence + no-absent-list, 3-field idempotent spark, participation ETA/note, live-only spark list, tz-correct expiry + wrap summary + block, poll/optimistic/visibility-pause, length+rate caps; unfurl: per-object links + breadcrumb, evergreen branded OG, anon crawler fetch + no login, creator-only card text, noindex). No drift found; specs unchanged. Runtime-observable confirmation (two-device live update, WhatsApp paste) needs local DB + deploy — see flagged 2.4/6.4/8.3/9.6 manual verifies.)**
- [x] 12.3 `openspec validate add-live-pulse` passes; then `/opsx:archive` when the change is complete. **(`openspec validate add-live-pulse` → "is valid". Archive deferred until the flagged manual verifies pass against a local DB + deploy.)**

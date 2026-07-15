## Context

`apps/web` today is the Asker: an SMS-railed, server-rendered coordination B-test. Its conventions are the baseline this rail must match:

- **Server-only DB.** All DB I/O goes through `lib/asker/repo.ts` using a raw `postgres` `sql()` pool (`lib/asker/db.ts`, a per-process singleton, `max: 1`, transaction pooler, `prepare: false`). The `asker` schema is explicitly "no RLS, no PostgREST exposure" (`supabase/migrations/20260611000000_asker_schema.sql`). The Supabase realtime publication is `public`-only (mobile app).
- **Identity is an opaque URL bearer token**, not a cookie/account: 144-bit `randomBytes(18)` (`lib/asker/ids.ts`), resolved server-side via `getMemberByToken`. There is no cookie/HMAC code anywhere in `apps/web`.
- **Mutations are `app/api/**` route handlers** taking `{ token }` in the body (`auth.ts: sessionFromBody`). Pages are `force-dynamic` server components that already `await params`. No client islands, no polling, no OG, no `generateMetadata` exist yet.
- **Stack**: Next.js 16.2.5 (App Router; async `cookies()`/`headers()`, `params` is a Promise, changed caching defaults — read `apps/web/node_modules/next/dist/docs/` before coding), React 19.2.4, `postgres` ^3.4.9, Vitest, Zustand (already a dep).
- **Load profile**: today the DB sees one cron every 15 min. This rail introduces continuous read traffic (polling) — a new load class.

Product intent and the visual reference: `design/SYSTEM-THESIS.md` §i and the storyboard `design/Bonfire Live Pulse - The System (standalone).html` (§04 board presence, §05 sparks, §07–08 "the chat holds the talk, the object holds the now", §09 explicit non-goals).

This design incorporates a prior architect review (identity simplification, schema hardening, unfurl realities, polling cost, timezone, abuse surface).

## Goals / Non-Goals

**Goals:**
- A link you paste into WhatsApp that unfurls to a curated card and opens to a live presence page, with **no app and no account**.
- Two independently-shareable objects: a durable **container** (board presence + a list of active sparks) and an ephemeral **spark** (per-person participation + TTL), where a spark can stand alone.
- Reuse the Asker's proven patterns (opaque tokens, server-only DB, API-route mutations, read-time expiry) so this rail adds no new architectural class beyond client-island polling.
- Make the B-test measurable (a small device-funnel log).

**Non-Goals (v1):**
- Accounts, profiles, push notifications, RSVP/Going–Maybe, any in-object chat thread, history/feeds, GPS/location (prototype §09).
- Cross-device identity continuity, host/admin roles, content moderation beyond length caps + keeping arbitrary user text out of unfurl cards.
- Supabase Realtime / websockets (polling is the v1 mechanism; Realtime is the named scale-up path).
- The vanity `bonfire.to` short domain (an optional later DNS/redirect layer; links are `APP_BASE_URL/p/...`).

## Decisions

### 1. New parallel rail in `apps/web`, own `pulse` schema, one shared pool
A `pulse` Postgres schema (server-only, no RLS, matching the asker schema) and `apps/web/lib/pulse/**` mirroring `lib/asker/**` (`repo`, `tokens`, `identity`, `time`, `copy`, `types`). Routes under `app/p/**` and `app/api/pulse/**`.
- **Shared pool**: hoist the `sql()` singleton from `lib/asker/db.ts` to a shared `apps/web/lib/db.ts` imported by both rails, and share `ids.ts`. *Why:* a forked `lib/pulse/db.ts` would open a second `max:1` pool per serverless instance, doubling pooler connections — which compounds the polling load. Domains stay isolated by schema, not by pool.
- *Alternative rejected:* a separate `apps/pulse` Next app — cleanest isolation but a whole new deploy/config for a B-test that wants to share infra.

### 2. Two-layer object model; nullable `container_id`; enriched participation
The prototype is genuinely two layers, and v1 keeps both:
- **Board presence** (§04): `(container_id, participant_id)` → a one-tap status (`around · busy · away · out`) + optional freeform note. Answers "can I grab anyone right now?" independent of any event.
- **Spark participation** (§05): `(spark_id, participant_id)` → a one-tap status (`in · on_my_way · here · out`) + optional `eta_minutes` + optional note.
- A **spark may have `container_id = null`** (standalone) — the spontaneous "USA vs Germany at Smithfield, 5pm" case. Same object, two share surfaces.
- *Why participation carries note + ETA:* the review caught that a standalone spark would otherwise be impoverished — it would lose the §i hero ("who's here, who's on the way (ETA), 'got us a table'"), which is exactly the lone-spark case. Enriching participation (rather than collapsing the layers) fixes the asymmetry while staying faithful to the prototype's two-layer design.
- *Alternative rejected:* one layer (spark-only, container as a pure folder) — leaner, but drops §04's "who's around" board screen.

### 3. Identity: opaque-token cookie, no HMAC, fragility-tolerant
- A `participant` is `(id uuid, display_name, created_at)` with a 144-bit `token` (reusing `ids.ts`). The token lives in an **httpOnly, Secure, SameSite=Lax, 1-year cookie** (`pulse_pid`) and is resolved server-side via `getParticipantByToken`, mirroring `getMemberByToken`.
- *Why no HMAC:* the participant id/token is already random and unforgeable; signing it adds a secret (`PULSE_COOKIE_SECRET`) and a code path the codebase doesn't have and doesn't need. Neither approach stops replay — whoever holds the cookie *is* that participant. This is low-stakes presence, not authentication; the spec says so.
- *Cookie fragility is designed-for, not wished-away:* WhatsApp's iOS in-app WKWebView often uses an ephemeral/partitioned cookie jar, so the same human can return as a different participant, and "open in Safari" / a forwarded re-share creates another. Therefore: **no hard "you already joined" errors**, one-tap re-name/re-claim, and a soft dedupe by `(container, display_name)` on the board. Expect duplicate/ghost participants and tolerate them.
- *Identity reaches the client via the server-rendered snapshot / `/state` payload* (`me: true`, my `display_name`, my current statuses) — never by reading the cookie in JS (it's httpOnly). `display_name` isn't secret, so it ships in the HTML.

### 4. Data model (`pulse` schema)
All status columns `CHECK`-constrained (asker convention); all free text capped in **both** DB (`CHECK length`) and API (`slice`).

| Table | Columns (essentials) |
|---|---|
| `participants` | `id uuid pk`, `token text unique`, `display_name text` (cap ~40), `created_at` |
| `containers` | `id uuid pk`, `token text unique`, `name text` (cap ~60), `version bigint not null default 0`, `created_by uuid`, `created_at`, `archived_at` |
| `sparks` | `id uuid pk`, `token text unique`, `container_id uuid null → containers`, `title` (cap ~60), `place` (cap ~60), `time_label` (cap ~30), `expires_at timestamptz`, `closed_at timestamptz`, `created_by uuid`, `client_uuid uuid`, `created_at` |
| `presence` | `container_id`, `participant_id`, `status text check(...)`, `note text` (cap ~80), `updated_at`; pk `(container_id, participant_id)` |
| `spark_participation` | `spark_id`, `participant_id`, `status text check(...)`, `eta_minutes int null`, `note text` (cap ~80), `updated_at`; pk `(spark_id, participant_id)` |
| `events` | append-only funnel log: `id`, `kind` (`open`/`name_set`/`status_set`/`spark_create`/...), `container_id?`, `spark_id?`, `participant_id?`, `at` |

- **Hot-path index**: partial index `sparks (container_id, expires_at) where closed_at is null` so the live-sparks read stays fast forever and dead rows never slow it (this is what makes "no GC cron needed" hold as rows accumulate).
- **`containers.version`**: a monotonic counter bumped on every write that affects a board (presence change, spark add/close, participation change on a child spark). Lets a poll be one indexed PK read returning an `ETag`. For a standalone spark, the equivalent is `max(updated_at)` over its participation + the spark row, or a `version` on the spark.
- **Idempotency**: `unique(container_id, created_by, client_uuid)` on `sparks` (client supplies `client_uuid`) so a double-tap / retry over a flaky in-app-browser connection does not create duplicate sparks (`on conflict do nothing`). Presence and participation are upserts (`on conflict (pk) do update`) — idempotent for free.
- **Tokens** stay 144-bit opaque (not short/enumerable). The token is a stated **bearer capability** — the only access control, an accepted consequence of "open to value." Per-table uniqueness is fine because the route prefix (`/p/c/` vs `/p/s/`) disambiguates namespaces.

### 5. WhatsApp unfurl: evergreen static card via `next/og`
- Per-token `generateMetadata` (async) sets `og:title` / `og:description` / `og:url` / `twitter:card=summary_large_image`; an `opengraph-image.tsx` segment renders a branded fire card via the bundled `next/og` `ImageResponse` (no `@vercel/og` dep). `metadataBase` is set from `APP_BASE_URL` so `og:image` is absolute HTTPS.
- **Evergreen, never a live count.** The preview is generated on the *sender's* device at paste and embedded in the E2EE message; recipients never re-fetch, so it's frozen at paste — a live count would be wrong the instant a second person opens it. This is also the safe common denominator across iMessage/Signal/Telegram. *To change a card, change the token (URL)* — WhatsApp's per-URL cache cannot be reliably purged.
- **Anonymous + cacheable**: the OG segment must NOT read the `pulse_pid` cookie (it's a separate route and must stay CDN-cacheable for the crawler). It declares `export const runtime = 'nodejs'` (the `postgres` driver is not edge-compatible) and does exactly one cheap read for the name/place/time.
- **Crawler-safe details**: keep the card visually flat and **measure the byte size** (WhatsApp silently drops oversized thumbnails — target a few-hundred-KB ceiling); PNG only; design legible content to survive a center-square crop; set `og:image:width/height` (1200×630); **no redirects** on the canonical URL (verify `trailingSlash`/host config); exempt crawler UAs (`WhatsApp`, `facebookexternalhit`, `Twitterbot`) from any rate limiting; `robots: noindex` (capability URLs must not be indexed).
- **Abuse-aware content**: the card renders only creator-set `title` / board `name` (tight caps) — never arbitrary participant notes — because the card unfurls in *other people's* group chats. `next/og` escapes HTML (no injection), but it would still render offensive text.

### 6. Rendering split: server snapshot + client island
Each page server-renders the current snapshot (instant first paint in WhatsApp's in-app browser, works before JS), then hydrates one Zustand-backed client island that handles taps and polling. *Why:* the link is tapped on mobile in an in-app webview; first paint must not wait on client JS. This is the first client-island/polling pattern in `apps/web` — justified by the link-railed, live nature of the surface.

### 7. Real-time: jittered polling with an O(1) freshness check
- The island polls `GET /api/pulse/{c|s}/[token]/state` (`force-dynamic`, `Cache-Control: no-store`) on a **jittered 4–7s** interval, pausing when the tab is hidden, with **optimistic update on the user's own tap** and **backoff on 429/5xx**.
- The poll sends `If-None-Match`; the server reads only `containers.version` (one indexed PK read) and returns `304` with no body when unchanged. *Why:* without the version column the "cheap" check would scan presence + sparks every few seconds, per board.
- *Why polling over Realtime:* Realtime would require adding `pulse` tables to the `public`-only realtime publication, shipping the anon key to the client, and writing RLS for anonymous devices — contradicting the server-only-DB ethos baked into both schemas. Polling preserves that boundary.
- *Named scale cliff:* at scale, N polls cost more DB than one replication stream. For a B-test polling is right; if pulse takes off, SSE/Realtime is the migration. Jitter + optimistic-own-tap let the interval stay long without hurting perceived latency (mitigates the "card re-surfaces on spikes" thundering herd).

### 8. Lifecycle: read-time TTL, timezone-correct expiry, explicit wrap
- A spark is **live** iff `closed_at IS NULL AND expires_at > now()`; expired sparks simply drop out of the active query (no cron needed for correctness, given the partial index).
- **`expires_at` is timezone-correct**: the human presets (`now` → +3h, `EOD`, an explicit clock time) are resolved to an absolute instant **client-side** from the creator's `Intl.DateTimeFormat().resolvedOptions().timeZone`, then the absolute `expires_at` is sent. *Why:* computed in server UTC, "EOD" would die mid-evening for a US user.
- **Explicit wrap** (§i step 5, "that's a wrap, 6 of you made it") sets `closed_at` via a mutation; TTL covers the implicit case. A GC cron (hard-closing long-dead rows, archiving stale containers) is deferred — hygiene only, not correctness.

### 9. Mutations: API routes, upserts, idempotency
Mutations are `app/api/pulse/**` route handlers (matching the Asker; route handlers can set the identity cookie on first write). Presence/participation upsert; spark creation uses the `client_uuid` idempotency key. *Alternative considered:* Server Actions — slightly cleaner cookie-setting, but consistency with the established API-route convention wins.

### 10. Abuse guards
Open creation has no SMS/phone gate (unlike the Asker), so: per-participant + per-container + per-IP caps on create/mutate (a small DB counter table in the spirit of `asker.sms_log` dedupe), hard length caps (DB `CHECK` + API `slice`), and the OG content restriction in §5. These travel together because the open surface and the unfurl-into-other-chats surface are the same attack.

### 11. Observability
A `pulse.events` append-only log captures the funnel (`open → name_set → status_set / spark_create`) so the measurable B-test claims ("under ten seconds," "reads as forming and alive at 3–4") can actually be evaluated. Mirrors `asker.page_views`.

## Risks / Trade-offs

- **In-app-webview cookie loss → duplicate/ghost participants.** → Design the whole presence UI to tolerate it (no hard "already joined", easy re-claim, soft dedupe by name). Documented as expected behavior, not a bug.
- **Polling is a new, continuous DB/serverless load.** → `version`/`ETag`/`304`, jitter, pause-on-hidden, optimistic-own-tap, backoff. Named Realtime/SSE as the scale path.
- **Token is the only access control.** → Stated bearer-capability model, 144-bit entropy, `noindex`. Acceptable under "open to value, never a wall."
- **Open creation invites spam, and user text can unfurl into other chats.** → Rate/length caps; OG renders only creator title/board-name; crawler UAs exempt from limits.
- **Unfurl silent-failures (oversized image, redirects, edge runtime).** → Flat card with measured bytes, Node runtime + single read, `metadataBase`, no-redirect canonical URL, square-crop-safe layout.
- **"EOD"/clock-time timezone bug.** → Resolve to absolute `expires_at` client-side from the creator's tz.
- **First client-island/polling pattern in a server-only codebase.** → Isolated to `app/p/**`; the Asker is untouched; Zustand already present.

## Migration Plan

1. Land the shared-pool refactor (`lib/db.ts`, shared `ids.ts`) with the Asker still green (existing Vitest suite must pass unchanged).
2. Add the `pulse` schema migration (new numbered file in `supabase/migrations/`), server-only, with all constraints/indexes above. Apply via `supabase db reset` locally.
3. Build `lib/pulse` + API routes + pages behind nothing special — the surface is simply unlinked from the Asker, so shipping it does not affect existing users.
4. Set `metadataBase`/`APP_BASE_URL` and verify the unfurl with a real WhatsApp paste + an OG debugger before sharing any link.
5. **Rollback**: the rail is additive and isolated (new schema, new routes, shared-pool refactor is behavior-preserving). Revert = drop the `pulse` routes/schema; the Asker is unaffected.

## Open Questions

- **Status copy** — board presence defaults to `around · busy · away · out`; spark participation to `in · on_my_way · here · out`. Final labels are confirmable during implementation (the enum is fixed; the display copy in `copy.ts` is cheap to change).
- **TTL preset values** — `now` → +3h is a guess; the preset set and defaults can be tuned once the loop is real.
- **Rate-limit thresholds** — exact per-participant/container/IP numbers to be set conservatively first, then loosened from the funnel data.

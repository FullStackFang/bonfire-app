# Add the Live Pulse rail — a WhatsApp-shareable presence link

## Why

Bonfire's thesis (`design/SYSTEM-THESIS.md` §i) treats loneliness as a repetition problem solved by low-stakes co-presence, and its atomic move is **a live link dropped into a group chat people already use** — no app, no account, "open to value, never a wall." The pulse is the one prototyped-but-unbuilt piece of that thesis (`design/Bonfire Live Pulse - The System (standalone).html`). Today `apps/web` only carries the Asker (an SMS-railed B-test); there is no link-railed surface at all. This change builds the link rail: a Bonfire URL you paste into WhatsApp that unfurls into a curated card and opens to a live "who's around / who's in" page — the structured *now* the chat can't hold.

## What Changes

- A new **link-railed surface** under `apps/web/app/p/`, parallel to the Asker, sharing the same Next.js 16 / Supabase / Vercel infra but with its own `pulse` Postgres schema and `lib/pulse/` domain code. The Asker is untouched.
- Two atomic objects, each independently shareable into a chat:
  - **Container** (a durable board, e.g. "GREECE '26") — shows each member's **board presence** (a one-tap status + an optional freeform note) and lists the active sparks inside it.
  - **Spark** (an ephemeral micro-event, e.g. "Sunset at the windmills · Oia · 8:30pm") — carries per-person **participation** (one-tap `in / on my way / here / out`, optional ETA + note) and a TTL. A spark may live inside a container **or** stand alone (the spontaneous single-event case).
- **Appless device identity**: a participant is a name typed once, held by an opaque-token cookie (the Asker's token pattern, not an account). The UI tolerates the in-app-browser cookie fragility this implies.
- **Curated chat unfurl**: each link type renders a branded, *evergreen* Open Graph card (title/place/time, never a live count) generated server-side, fetched anonymously by chat-app crawlers.
- **Live page, no reload**: after the tap, the page reflects others' status changes within a few seconds without a manual refresh.
- **Open creation with guards**: anyone with a link can add a spark or set presence (no host role in v1), bounded by rate limits and length caps because user text can unfurl into other people's chats.
- A new `pulse` schema migration (numbered after the asker schema) plus a small device-funnel event log so the B-test is measurable.
- **Out of v1** (honoring the prototype's §09): accounts, profiles, push notifications, RSVP/Going–Maybe, any in-object chat thread, history/feeds, GPS/location.

## Capabilities

### New Capabilities
- `live-pulse`: the on-page experience — device identity, containers, board presence, sparks, spark participation (status/ETA/note), read-time TTL lifecycle, open creation with rate/length guards, and live (no-reload) freshness.
- `pulse-link-unfurl`: the in-chat surface — the two shareable link types and the curated, evergreen, anonymously-fetchable preview card their URLs produce when pasted into a chat app.

### Modified Capabilities
<!-- None. `openspec/specs/` has no published capability specs yet; both capabilities here are new. The Asker (apps/web) is not modified. -->

## Impact

- **New code**: `apps/web/app/p/**` (pages + OG image routes), `apps/web/app/api/pulse/**` (mutations + state polling), `apps/web/lib/pulse/**` (repo, tokens, identity, time, copy, types).
- **Shared infra change**: hoist the `postgres` `sql()` singleton out of `lib/asker/db.ts` into a shared module so both rails use one connection pool (avoids a second `max:1` pool per serverless instance); share the 144-bit token generator (`lib/asker/ids.ts`).
- **Database**: one new migration creating the `pulse` schema (server-only, no RLS/PostgREST exposure, matching the asker schema).
- **Config**: set `metadataBase` from the existing `APP_BASE_URL`; no new secret required (identity reuses the opaque-token pattern).
- **Dependencies**: none added — OG cards use the bundled `next/og`; polling needs no client DB keys.
- **Deployment**: chat-app crawler UAs must be exempt from any rate limiting/firewall so previews don't break.
- **No backend impact on the Asker or the mobile `public` schema.**

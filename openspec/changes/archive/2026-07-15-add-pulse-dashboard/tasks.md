# Tasks

Implement in order. Each group leaves `apps/web` building (`npm run build`) and Vitest green. Verify runtime behavior against the local PGlite stack (`npm run dev:local`, app on :3001).

## 1. Schema + repo reads

- [x] 1.1 Add `dash_view` to the `pulse.events.kind` CHECK in `supabase/migrations/20260612000000_pulse_schema.sql` (rewrite in place — never pushed).
- [x] 1.2 `lib/pulse/repo.ts`: `crewsForParticipant(participantId)` — crews via `crew_members` ∪ `presence`, `archived_at is null`, left-joined to my presence (status/note), ordered by my latest activity.
- [x] 1.3 `lib/pulse/repo.ts`: `pulsesForParticipant(participantId, now, pastLimit)` — created ∪ responded, left-join crew name, my response status; returns live (soonest expiry first) and earlier (most recent first, capped) in one shape.
- [x] 1.4 Repo tests: creator-without-response included; wrap/expiry moves a pulse from live to earlier; presence-only crew included; archived crew excluded; another participant's rows never returned.

## 2. Dash payload + copy

- [x] 2.1 `lib/pulse/serialize.ts`: `serializeDash(...)` → public shapes only (tokens, names, labels, my status) — no internal ids of other participants.
- [x] 2.2 `lib/pulse/copy.ts`: dash strings (section overlines, empty-state copy, "dropped by you" credit, recovery blurb) following the content rules (statements, quiet history, no guilt framing).

## 3. `/p` page

- [x] 3.1 `app/p/page.tsx` — server component (`force-dynamic`, `robots: noindex`): `getViewer()` → repo reads → sections LIVE NOW / YOUR CREWS / EARLIER in the design system (pulse cards like the board's, crew rows with my status pill, earlier rows muted). Log `dash_view` for non-crawlers.
- [x] 3.2 Empty state: no viewer or no content → "Start something" CTA (→ `/p/new`) + recovery entry.
- [x] 3.3 Recovery island (`dash.client.tsx` or similar): "Been here before?" → existing `VerifySheet`; on verified, `router.refresh()`. Shown only when unverified or empty (verified-with-content sees no identity chrome).

## 4. Way back home

- [x] 4.1 `BrandRow` (app/p/ui.client.tsx): wrap the ember + wordmark in a link to `/p` on crew, pulse, and new pages.
- [x] 4.2 Optional (owner call): redirect `/` → `/p` instead of the map prototype.

## 5. Validation

- [x] 5.1 `npm run test` green (incl. new repo tests); `npm run build` clean; new files lint clean.
- [x] 5.2 Runtime walk on `dev:local`: fresh device sees empty state; create crew + pulse + respond → dash shows all three correctly sectioned; wrap the pulse → moves to EARLIER; brand row navigates home from every page.
- [x] 5.3 Walk both spec files against the running app; `openspec validate add-pulse-dashboard` passes.

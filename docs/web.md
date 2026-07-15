# apps/web — The Asker (v3 B-test)

An SMS-railed, server-rendered group coordination system. No client-side auth — all state lives in Postgres (`asker` schema), all communication via Twilio SMS. Canonical spec: `docs/superpowers/specs/2026-06-10-bonfire-mvp-spec-v3.0.md`.

## Routes

| Route | Purpose |
|---|---|
| `/new` | Circle creation |
| `/join/[circleId]` | Join invite flow |
| `/t/[token]/` | Member SMS responder pages (rounds, events, places) |
| `/api/cron/tick` | Scheduled tick — authenticated by `x-cron-secret` header |
| `/api/rounds`, `/api/attendance`, `/api/venues`, `/api/events`, `/api/kindling` | API routes |

The cron tick fires every ~15 minutes via GitHub Actions (`.github/workflows/asker-tick.yml`).

## Library (`apps/web/lib/asker/`)

~24 files. Key ones:

| File | Responsibility |
|---|---|
| `repo.ts` | All DB reads/writes against the `asker` schema |
| `planner.ts` | Round scheduling logic |
| `tick.ts` | Cron orchestration — called by `/api/cron/tick` |
| `sms.ts` | Twilio send + deduplication |
| `time.ts` | Cadence / slot math |
| `phone.ts` | E.164 normalization |
| `copy.ts` | SMS message copy |

## Stack

Next.js 16.2.5 · React 19.2.4 · TailwindCSS 4 · Supabase (`@supabase/supabase-js` + raw `postgres` for SQL) · Twilio 6 · Zustand 5 · Vitest 4 · ESLint 9

## Env vars (see `apps/web/.env.example`)

```
DATABASE_URL=           # Supabase transaction pooler URL
APP_BASE_URL=
CRON_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=+1xxxxxxxxxx
SMS_DRY_RUN=1           # Set to 0 to send real SMS
```

## Invariants — never violate

- `rounds.source` and raw reply counts never leave the server. Only `serializeRound()` output is sent to the client.
- **Absence is never displayed.** No out-lists, no silence-lists, no individual flake data anywhere.
- All SMS sends deduplicated on `(member, kind, context)` — non-event messages ≤1/member/day; rounds ≤1/day and ≤3/week per circle.
- The cron endpoint requires `x-cron-secret` header matching `CRON_SECRET`. Unauthenticated ticks are rejected.

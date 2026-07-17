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
AI_GATEWAY_API_KEY=     # Vercel AI Gateway key (plan proposer) — optional locally
PLAN_AI_MODEL=          # Gateway model slug (default anthropic/claude-sonnet-5)
```

### Plug in a real AI (plan proposer)

The plan proposer (`lib/pulse/plan-ai.ts`) calls Anthropic through the **Vercel AI Gateway**.
Without a credential it silently uses deterministic fallback options (create never fails).

- **Local**: put `AI_GATEWAY_API_KEY` in `apps/web/.env.local` (create one in the Vercel
  dashboard under AI Gateway → API Keys), or `vercel env pull` for a ~24h `VERCEL_OIDC_TOKEN`.
- **On Vercel**: automatic — `VERCEL_OIDC_TOKEN` is injected, no key to manage.
- Every Vercel team gets **$5/month of free gateway credits**; a spent budget (402) or rate
  limit (429) degrades to fallback options rather than breaking plan creation.

## Invariants — never violate

- `rounds.source` and raw reply counts never leave the server. Only `serializeRound()` output is sent to the client.
- **Absence is never displayed.** No out-lists, no silence-lists, no individual flake data anywhere.
- All SMS sends deduplicated on `(member, kind, context)` — non-event messages ≤1/member/day; rounds ≤1/day and ≤3/week per circle.
- The cron endpoint requires `x-cron-secret` header matching `CRON_SECRET`. Unauthenticated ticks are rejected.

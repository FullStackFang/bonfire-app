# Bonfire — the Asker (B-test)

Spec: `docs/superpowers/specs/2026-06-10-bonfire-mvp-spec-v3.0.md`. SMS-railed, appless, server-side only.

## Local dev

1. `supabase start && supabase db reset` (Docker)
2. `cp apps/web/.env.example apps/web/.env.local`, set `DATABASE_URL` to the local connection string
   (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`), keep `SMS_DRY_RUN=1`
3. `npm run dev:web` → http://localhost:3000/new
4. Tests: `npm run test --workspace=apps/web`. Integration tests need
   `TEST_DATABASE_URL` set to the local connection string.
5. To exercise the tick by hand:
   `Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/cron/tick -Headers @{'x-cron-secret'='change-me'}`

## Deploy (Vercel)

1. Vercel project root: `apps/web`. Build command default; the repo pins webpack via `--webpack`.
2. `supabase link --project-ref <ref> && supabase db push` (applies `20260611000000_asker_schema.sql`).
3. Set env vars in Vercel: `DATABASE_URL` (transaction pooler URL), `APP_BASE_URL` (the deployment URL),
   `CRON_SECRET`, Twilio trio, `SMS_DRY_RUN` (=1 until launch day, then remove).
4. GitHub repo secrets: `TICK_URL=https://<deployment>/api/cron/tick`, `CRON_SECRET` (same value).
   The workflow `.github/workflows/asker-tick.yml` fires every ~15 min (GitHub adds jitter; the engine tolerates it).
5. Twilio: buy a US number. Honest note: unregistered 10DLC traffic can get carrier-filtered;
   for ~40 testers either complete toll-free verification or accept some filtering risk and
   watch `sms_log` for `[FAILED]` bodies on launch night.

## Launch checklist (per circle)

1. Founder scrolls the group chat back 4 weeks, counts hangs that happened, logs the number in
   `docs/superpowers/specs/2026-06-10-b-test-run-log.md` **before** inviting anyone.
2. `/new` → create circle (K=2 unless the circle is >8 people).
3. Adjust cadence/verbs in SQL if the defaults don't fit the group
   (`update asker.circles set cadence = '[...]', verb_set = '[...]' where id = ...`).
4. Paste the join link into the group chat — the only chat-paste, ever.
5. Flip `SMS_DRY_RUN` off. Watch the first ask go out at the next send window.

## Invariants (do not break)

- `rounds.source` and reply counts never reach a client. `serializeRound` is the only round serializer.
- Absence is never displayed: no out-lists, no silence-lists, anywhere.
- All sends dedupe on `(member, kind, context)`; non-event SMS ≤1/member/day; rounds ≤1/day, ≤3/week per circle.

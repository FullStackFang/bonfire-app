# Tasks: Route the Plan Proposer Through Vercel AI Gateway

## 0. Confirm the slug

- [x] 0.1 Run `gateway.getAvailableModels()` (or check the AI Gateway dashboard) and pick a valid Anthropic slug (dotted, provider-prefixed, e.g. `anthropic/claude-sonnet-4.6`); confirm whether an Opus slug is offered. Do not guess. *(Confirmed via the gateway's public model list: `anthropic/claude-sonnet-5`, `anthropic/claude-sonnet-4.6`, and `anthropic/claude-opus-4.8` are all offered. Founder picked `anthropic/claude-sonnet-5` as the default.)*

## 1. Switch the proposer to the gateway

- [x] 1.1 In `apps/web/lib/pulse/plan-ai.ts`: replace `model: anthropic(MODEL)` with the gateway model string `model: process.env.PLAN_AI_MODEL || DEFAULT_SLUG`; remove the `@ai-sdk/anthropic` import from this file
- [x] 1.2 Set `DEFAULT_SLUG` to the confirmed slug from 0.1 (`anthropic/claude-sonnet-5`)
- [x] 1.3 Change the pre-flight guard from `!process.env.ANTHROPIC_API_KEY` to "no gateway credential": `!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN)` → return `fallbackOptions(ctx)`
- [x] 1.4 Extend the catch to treat gateway 402 (budget) and 429 (rate limit) as fallback triggers via `APICallError.isInstance(err)` + `err.statusCode` (the existing catch-all already covers timeouts/5xx)

## 2. Config + docs

- [x] 2.1 Add `AI_GATEWAY_API_KEY=` and a `PLAN_AI_MODEL=anthropic/claude-sonnet-5` note (gateway slug format) to `apps/web/.env.example`
- [x] 2.2 Add a short "plug in a real AI" note to the deploy docs: local = `AI_GATEWAY_API_KEY` in `.env.local` (or `vercel env pull`); Vercel = automatic via OIDC; $5/mo free credits *(added to `docs/web.md`)*

## 3. Tests

- [x] 3.1 Update `plan-ai.test.ts`: the no-key case now asserts the **gateway-credential** guard (unset both `AI_GATEWAY_API_KEY` and `VERCEL_OIDC_TOKEN` → fallback, no throw); mapper/fallback tests unchanged
- [x] 3.2 (Optional) Add a unit for the 402/429 → fallback path using a mocked `APICallError`

## 4. Verification

- [x] 4.1 `npm run test`, `npm run lint`, `npm run build` in `apps/web` all clean *(97 tests pass; lint 0 errors — 2 pre-existing warnings in `lib/asker/`; production build succeeds)*
- [x] 4.2 With `AI_GATEWAY_API_KEY` set locally: `npm run dev:local`, open `/p/plan/new`, enter an intent → real (non-placeholder) time+place options appear *(Verified 2026-07-16: key in `apps/web/.env.local`, POST `/api/pulse/plan` with a "dinner in the West Village" intent → 4 real venue options (Via Carota, The Waverly Inn, Buvette, I Sodi) with distinct rationales from `anthropic/claude-sonnet-5`. Known gap surfaced: the prompt doesn't include today's date, so proposed dates can land in the past — follow-up outside this change.)*
- [x] 4.3 With no gateway credential: create still returns the deterministic fallback options and the flow completes (the current verified behavior) *(Verified live 2026-07-16 against `dev:local` on :3001 with no credential in env: POST `/api/pulse/plan` → 200 with the two fallback options (Thu 7:00 PM / Sat 6:00 PM · Somewhere nearby), publish → 200 → state `open`, plan page renders intent + options. Compiled dev bundle confirmed to contain the new gateway code.)*

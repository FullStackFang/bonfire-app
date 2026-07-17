# Route the Plan Proposer Through Vercel AI Gateway

## Why

Phase 1's AI proposer (`lib/pulse/plan-ai.ts`) currently calls Anthropic directly via `@ai-sdk/anthropic`, which requires an `ANTHROPIC_API_KEY`. With no key set it silently uses deterministic fallback options — which is why the intent box only ever shows placeholder times locally. Getting a real key is friction, and it hardwires one provider.

**Vercel AI Gateway** removes that friction and fits how this app deploys:
- **Zero-config on Vercel** — the gateway authenticates via an auto-provisioned `VERCEL_OIDC_TOKEN`; no key to manage in production.
- **One env var locally** — `AI_GATEWAY_API_KEY` in `.env.local` (or `vercel env pull`), instead of hunting down a provider key.
- **$5/month free credits** per Vercel team — enough to actually try real AI suggestions with no commitment.
- **Provider-agnostic** — swap models by changing a string (`anthropic/…`, `openai/…`), with built-in failover and per-feature cost tracking (tags) if wanted later.

Routing is a plain `"provider/model"` string to the AI SDK's `model` param — the packages (`ai@7` + `@ai-sdk/gateway`) are **already installed** (bundled with the AI SDK). This is a small, surgical change to the proposer's model reference, auth env, and fallback triggers — no route, schema, or UI change.

## What Changes

- **`lib/pulse/plan-ai.ts`** — call `generateObject` with a gateway model **string** (e.g. `anthropic/claude-sonnet-4.6`) instead of `anthropic(MODEL)`. Keep the model env-configurable via `PLAN_AI_MODEL` (now a gateway slug). Remove the direct `@ai-sdk/anthropic` import from this path.
- **Auth env** — the proposer's "has a key?" guard changes from `ANTHROPIC_API_KEY` to the gateway's credential (`AI_GATEWAY_API_KEY` **or** `VERCEL_OIDC_TOKEN`). With neither present it still falls back to deterministic options, so create never hard-fails locally.
- **Expanded graceful degradation** — the fallback already covers model errors; extend it to the gateway's cost/rate signals (HTTP **402** budget exceeded, **429** rate limited) and timeouts, so a spend cap or throttle degrades to fallback options rather than erroring the create.
- **Docs/env** — add `AI_GATEWAY_API_KEY` (and the `PLAN_AI_MODEL` gateway-slug note) to `.env.example`; a short "plug in a real AI" note in the deploy docs.
- **Tests** — update `plan-ai.test.ts`'s no-key case to assert the gateway-credential guard; the pure mapper/fallback tests are unchanged.

## Capabilities

### Modified Capabilities

- `plan-coordination`: the "AI proposes candidate options" requirement gains provider-agnostic routing through a configurable model gateway and explicit graceful degradation on missing credentials, budget limits, rate limits, and timeouts. The observable behavior — validated structured options, or deterministic fallback, never a hard failure — is unchanged.

## Non-goals

- No change to the plan lifecycle, schema, routes, or availability UI.
- No provider failover chains, cost tags, per-user rate limiting, or caching yet — the gateway supports them, but Phase 1 uses the plain single-model path. (Noted as easy follow-ups in `design.md`.)
- Not removing the `@ai-sdk/anthropic` dependency from the repo (other rails may use it later); only the proposer stops importing it.

## Impact

- `apps/web/lib/pulse/plan-ai.ts` — model reference + auth guard + fallback triggers.
- `apps/web/lib/pulse/plan-ai.test.ts` — no-key/credential-guard case.
- `apps/web/.env.example` (+ deploy docs) — `AI_GATEWAY_API_KEY`, `PLAN_AI_MODEL` gateway slug.
- **No new dependency** — `@ai-sdk/gateway` ships with the already-installed `ai@7`.
- Depends on `add-plan-without-chat` (the proposer it modifies), which is complete.

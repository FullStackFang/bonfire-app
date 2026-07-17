# Design: Route the Plan Proposer Through Vercel AI Gateway

## Context

`lib/pulse/plan-ai.ts` (from `add-plan-without-chat`) generates candidate options with the AI SDK's `generateObject` against a Zod schema, currently using the direct provider `anthropic(MODEL)` from `@ai-sdk/anthropic` and gated on `ANTHROPIC_API_KEY`. It already degrades to deterministic `fallbackOptions()` on any error or a missing key, so create never hard-fails. This change swaps the transport to Vercel AI Gateway without touching that contract.

Verified against the `vercel:ai-gateway` skill and the installed packages: `ai@7.0.29` exports `gateway` / `createGateway`, and `@ai-sdk/gateway@4.0.21` is already present (bundled). Routing through the gateway needs **no new dependency and no `gateway()` wrapper** — passing a plain `"provider/model"` string as `model` routes automatically.

## Goals / Non-Goals

**Goals:**
- Proposer calls the model through AI Gateway via a `provider/model` string.
- Auth works zero-config on Vercel (OIDC) and with one env var locally (`AI_GATEWAY_API_KEY`).
- Model is swappable by config (`PLAN_AI_MODEL`), not code.
- The "never hard-fail" guarantee is preserved and extended to gateway cost/rate signals.

**Non-Goals:**
- No failover `order`/`models`, cost `tags`, per-user rate limiting, or `cacheControl` yet (all gateway features, all easy later — see Follow-ups).
- No behavior change visible to the opener or invitees.

## Decisions

**1. Route via a plain `provider/model` string, not the `gateway()` wrapper.**
`generateObject({ model: process.env.PLAN_AI_MODEL || DEFAULT_SLUG, schema, system, prompt })`. The AI SDK auto-routes any `"provider/model"` string through the gateway. The `gateway()` wrapper is only needed for `providerOptions.gateway` (routing/tags), which Phase 1 doesn't use. Alternative considered: keep `@ai-sdk/anthropic` and only add the gateway as failover — rejected as premature; the gateway is the simpler default path per the skill's decision tree (we want cost tracking + provider-agnosticism, not a provider-specific feature).

**2. Model slug format is dotted and provider-prefixed — verify before hardcoding.**
Gateway slugs use dots for versions and a provider prefix: `anthropic/claude-sonnet-4.6` (NOT the bare `claude-opus-4-8` the direct Anthropic SDK uses). **Default: `anthropic/claude-sonnet-4.6`** — a documented-valid slug, plenty for short plan-suggestion prompts, and cheap enough to live comfortably inside the $5/month free credits. At implementation time, confirm the exact available slug with `gateway.getAvailableModels()` (e.g. whether `anthropic/claude-opus-4.8` is offered) rather than guessing. `PLAN_AI_MODEL` overrides it, so the founder can bump to an Opus slug or switch providers (`openai/…`) without a code change.

**3. Auth guard resolves the gateway credential, not the Anthropic key.**
`@ai-sdk/gateway` resolves auth in order: `AI_GATEWAY_API_KEY` → `VERCEL_OIDC_TOKEN` (via `@vercel/oidc`). The proposer's pre-flight guard becomes "is a gateway credential present?" — `!!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN)`. If neither is set (a bare local checkout), it skips the call and returns fallback options, exactly as today. On Vercel, `VERCEL_OIDC_TOKEN` is auto-injected, so production "just works" with no key.

**4. Extend graceful degradation to gateway cost/rate signals.**
Today the `try/catch` degrades on any thrown error. Keep that catch-all (it already covers timeouts and 5xx), and additionally treat the gateway's **402 (budget exceeded)** and **429 (rate limited)** as fallback triggers rather than surfacing them — a spend cap or throttle should quietly yield placeholder options, never break plan creation. Detect via `APICallError.isInstance(err)` + `err.statusCode`. This keeps the create path's "never hard-fail" invariant true under real-world cost controls.

**5. Local dev path — the founder's actual question.**
Two ways to get real AI locally, documented in `.env.example`:
- **Static key (simplest):** create an AI Gateway key in the Vercel dashboard (AI Gateway → API Keys), put `AI_GATEWAY_API_KEY=…` in `apps/web/.env.local`, restart `npm run dev:local`. The intent box now returns real suggestions.
- **OIDC (no static key):** `vercel link` then `vercel env pull apps/web/.env.local` writes a ~24h `VERCEL_OIDC_TOKEN`; re-pull when it expires.

## Risks / Trade-offs

- **[Guessed model slug 400s]** → Don't hardcode blind; confirm via `getAvailableModels()` at build time. Default to the skill-documented `anthropic/claude-sonnet-4.6`. A bad slug returns a 400, which the fallback catch absorbs (create still succeeds with placeholders) — but it should be caught in the verify step, not shipped.
- **[OIDC token expiry surprises local dev]** → The static `AI_GATEWAY_API_KEY` path avoids the 24h expiry; recommend it for local, OIDC for deployed.
- **[Free credits run out]** → 402 degrades to fallback (Decision 4), so the app keeps working; the founder sees placeholder options as the signal to top up. Budget alerts are a dashboard setting, out of scope here.
- **[Content logging / privacy]** → The gateway does not log prompt/completion content by default. Intent text is low-sensitivity, but note it if content logging is ever enabled.

## Follow-ups (not in this change)

- Provider failover (`providerOptions.gateway.order` / `models`) for resilience.
- Cost attribution `tags` (`feature:plan-proposer`) and per-user `user` tracking.
- `cacheControl` on identical intents (low value — intents vary).

## Open Questions

- ~~Final default slug: `anthropic/claude-sonnet-4.6` vs an Opus slug if `getAvailableModels()` lists one. Leaning Sonnet for cost on the free tier; founder can override via `PLAN_AI_MODEL`.~~ **Resolved (2026-07-16):** the gateway's public model list offers `anthropic/claude-sonnet-5`, `anthropic/claude-sonnet-4.6`, and `anthropic/claude-opus-4.8`; founder picked **`anthropic/claude-sonnet-5`** (latest Sonnet tier, same $3/$15 sticker as 4.6 with $2/$10 intro pricing through 2026-08-31). `PLAN_AI_MODEL` overrides.

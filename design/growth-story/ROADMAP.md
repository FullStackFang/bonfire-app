# Growth Story — Program Roadmap

> External research triage lives in `INSIGHT-REGISTER.md` (per-insight verdict, build status, evidence).

> Program-level companion to `design/SYSTEM-THESIS.md`. Source design: Claude Design project "Bonfire Design System" → `ui_kits/growth_story/index.html` (a 3-phase product walkthrough). The concrete, buildable spec for Phase 1 lives in OpenSpec at `openspec/changes/add-plan-without-chat/`. Phases 2–3 below are roadmap-level intent, deferred until Phase 1 ships and their conflicts resolve — they become full OpenSpec changes (via `opsx:propose`) when promoted.

## The arc

| Phase | Story title | Product goal | Surface | Status |
|---|---|---|---|---|
| 1 · The Wedge | "Make plans without the group chat" | Land and love the core | `apps/web` **Pulse rail** (`/p`), reusing Asker's vote-and-confirm engine | **Specced** → `openspec/changes/add-plan-without-chat/` |
| 2 · The Network | "See who's around when it matters" | Increase usage + network density | web Pulse rail (`/p/around`) | ✅ **Complete** → `add-network-discovery` (coarse, no-GPS) |
| 3 · Relationship Intelligence | "Bonfire becomes proactive" | Be indispensable in your social life | web Pulse rail (dashboard card) | **Built (v1, 14/16)** → `add-relationship-intelligence` (opt-in, crew-scoped) |

Phase 1 is the wedge and the only phase with committed design detail. Phases 2–3 are held at roadmap altitude — enough to carry the intent and the open conflicts — and are deliberately not over-specified while they remain far off and conflict-laden.

## Decisions (2026-07-15)

- **Scope:** build all three phases as product (a multi-milestone program), not just the walkthrough page.
- **Phase 1 surface:** `apps/web`, **anchored on the Pulse rail** (`/p` — the live front door, already has no-account share links + phone-OTP + ghost-merge identity), **reusing Asker's strike-at-K vote-and-confirm logic** ported in as transport-agnostic domain code (no SMS).
- **Thesis conflicts:** all resolved (see `conflicts.md`). **`SYSTEM-THESIS.md` is non-binding for this program (2026-07-15)** — the growth story governs; C1 → hybrid (by choice), C2 & C3 → build as drawn.

## Status (2026-07-16)

- **AI provider** (`use-ai-gateway-proposer`) — ✅ **Complete (2026-07-16)**, verified live: the proposer routes through Vercel AI Gateway; a real key in `.env.local` yields real venue options from **`anthropic/claude-sonnet-5`** (default, env-overridable via `PLAN_AI_MODEL`); no credential → deterministic fallback. Past-dates bug **fixed (2026-07-16):** the proposer prompt now anchors to the opener's today (timezone-aware) and forbids past dates.
- **Phase 1** (`add-plan-without-chat`) — ✅ **built & verified end-to-end (2026-07-16)**, including a hands-on real-browser run: intent → live-AI future-dated options → publish → no-account link → availability → threshold → auto "it's on" + calendar. Ready to archive once the OpenSpec lifecycle catches up (see note below).
- **Phase 2** (`add-network-discovery`) and **Phase 3** (`add-relationship-intelligence`) — proposed (specs below promoted to OpenSpec changes; each carries gating decisions).
- **Close the loop** (`close-plan-loop`) — ✅ **built & verified end-to-end (2026-07-16)**, hands-on browser run included: plan lifecycle gains `completed` (struck is no longer terminal), deadlines auto-strike the best option instead of expiring, and the completed plan's link shows the afterglow — one "do this again?" tap creates/joins the plan's **ember** (silence invisible, co-tappers revealed only when mutual), and a mutual ember seeds the next plan through the normal proposer. The ember is the thesis's sanctioned "again" engine made real — it becomes the **future `relationship-intelligence` trigger** (mutual embers are a stronger rekindle signal than raw co-attendance recency) and the substrate for standing-cadence auto-spawn; both are deliberate follow-up deltas, not built here.
- **Intent layer** (`add-intent-layer`) — 🛠 **built (2026-07-20)**, the ember follow-up delta above, made real. Adds the *person* half of recurrence alongside the ember's *activity* half: a directed **person intent** (one tap on a co-attendee's face in the afterglow's new zone two; unilateral, mutual-only symmetric reveal, one-sided invisible, withdrawable — the ember's privacy model transposed onto a directed pair) and a pure read-time **intent resolver** that joins mutual embers × mutual person intents × availability into ranked draft-plan candidates (compound matches — one plan satisfying both signals — rank highest), surfaced pull-only as a dashboard card; accept drafts a plan via the normal proposer, nothing is ever sent. Also lands the **`campfire-knowledge` doctrine** (provenance / crew-scope / defaults-only surfacing / decay) that every future intelligence surface builds against, with the resolver as its first compliant consumer. **Deferred (phase 2, spec'd not built):** *ambient capture* — registering a person intent outside the afterglow moment (inbound SMS to the Bonfire number, share-sheet, widget), which needs inbound Twilio + parsing + person-resolution against the co-attendance graph; and pushing mutual-match reveals through the reconnect nudge channel (a later delta against `relationship-intelligence`).

## The two rails inside `apps/web` (context)

```
apps/web
├── ASKER rail  (/t, /new, /join · schema asker.*) — SMS cron nudge-engine
│     has: vote primitive (replies in/later/out), strike-at-K, events/venues/attendance
│     lacks: AI, multi-option times, per-plan appless link (tokens are per-member + phone-gated)
└── PULSE rail (/p, /api/pulse · schema pulse.*) — the live front door (root redirects here)
      has: no-account share links + OG unfurl, phone-OTP verify, ghost-merge identity, polling client
      hosts: in-flight add-phone-signin, add-live-pulse
```

Phase 1 splits across both: *AI options + no-account link* is Pulse's strength; *pick → it's on* is Asker's. We anchor on Pulse and port Asker's confirm logic — reusing more than we rebuild.

## Thesis conflicts (open — founder decides)

The growth story contradicts three `SYSTEM-THESIS.md` DNA principles. With the thesis non-binding (2026-07-15), all three are resolved in `conflicts.md`:

- **C1** — ✅ **C1-C** (Phase 1): availability framing, not RSVP; no decline control. Built into the Phase-1 spec. Retained by choice.
- **C2** — ✅ **B, build as drawn** (Phase 2): city map + per-person distances.
- **C3** — ✅ **B, build as drawn** (Phase 3): recency-based relationship intelligence ("42 days").

`SYSTEM-THESIS.md` now diverges from the shipped direction and should be annotated (superseded banner) or archived — founder to decide.

---

## Phase 2 — The Network (deferred)

> Roadmap intent, not a committed design. Promote to a full OpenSpec change after Phase 1 ships and **C2** is resolved. Do not implement from this section.

**Why:** the single-plan wedge becomes a network — people install Bonfire and presence ("3 friends from Cornell are around this week") turns into spontaneous get-togethers. Presence territory, largely `apps/mobile` with a web complement.

**Intent (not spec):**
- A coarse, self-reported "who's around" presence layer for your people in a place (the growth story's "you're in Toronto / people around you" screens).
- Spontaneous coordination: activity chips + "when" → go live → Bonfire suggests a spot when enough friends are in — reusing Phase 1's plan/confirm engine at its core.
- Builds on existing capabilities `openspec/specs/{who-is-around,availability,live-pulse}` rather than a parallel presence model.

**Blocking conflict:** **C2** (map + per-person distances vs. "never live GPS"). The A/C resolutions (coarse buckets, no live map) materially change this phase's surface.

---

## Phase 3 — Relationship Intelligence (deferred)

> Roadmap intent, not a committed design. Promote to a full OpenSpec change after Phases 1–2 ship and **C3** is resolved. Do not implement from this section.

**Why:** Bonfire stops waiting to be opened and starts looking out for your relationships — a morning card notices you haven't seen someone, checks their availability, and offers to plan it, then handles the details. Most AI/agentic of the three phases.

**Intent (not spec):**
- Proactive suggestions ("you haven't seen X — they're free Thursday, want me to plan it?") that, on yes, draft a full plan via the Phase 1 proposer and send the invite.
- An agentic "plans the details for you" layer over Phase 1's plan object + Phase 2's availability signals.
- Builds on the thesis' sanctioned **"again" engine** and **rekindle nudge**, not a from-scratch mechanic.

**Blocking conflict:** **C3** ("42 days since Sarah" per-contact recency = the CRM the thesis disavows). The A/C resolutions (fire only off mutual "again", scope to crews, opt-in) materially change what this phase is.

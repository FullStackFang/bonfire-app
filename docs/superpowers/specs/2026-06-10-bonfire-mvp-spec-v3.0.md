# Bonfire Spec v3.0 — The Asker (B-test)

**Last updated:** June 10, 2026
**Status:** Canonical build spec. Supersedes `2026-06-09-bonfire-mvp-spec-v2.1.md` as the active build target. v2.1 is **archived, not killed** — it is the canonical Product A (the Fire) document and the act-two layer of this spec (§ Act two).
**Timebox:** ~2 weeks build (core ships in 1), 3 clean weeks run, readout week of July 20, 2026.

---

## What changed and why

The team sessions surfaced that v2.1 contained two products:

- **Product A — the Fire** (mortality, fog of war, torch, vouch, hearth): manufactures community for people who don't have one. Romantic, fundable, the best headline we own ("the first app that ends if you don't show up").
- **Product B — the Asker** (kindling, verbs, threshold strike, ETA, appless links): activates groups that already exist.

They were never actually two products. **A's anchor ritual was always "the app does the asking," pointed at semi-strangers.** The torch, the T-48h reveal, the fire's voice — all of it exists because nobody in a 25-person group of acquaintances will pay the asker tax (planning labor + rejection risk). B points the identical engine at groups where the love already exists and only the tax is missing. Same diagnosis, same engine, two populations.

**B is the better first test by every measure:** no cold start, no seeded warmth, no 8-week build, testable on our own group chats in weeks. B earns the right to build A.

### Epistemic honesty (pre-registered)

B succeeding does **not** validate A. A's bet — that ritual + mortality can manufacture community among semi-strangers — is untested by B. What B tests is A's single most load-bearing mechanism: **software-initiated asks convert to bodies at tables.** Timeleft proved it for strangers; B tests it for existing friend groups against the group-chat baseline. A great B result must not be quietly read as proof of the fire.

---

## The thesis, B form

Every hang that doesn't happen dies because someone had to go first — and most nights, nobody does. **Bonfire is the designated asker and the designated fall guy.** The app pays the asker tax: it asks so no person has to, it keeps "I'm down" secret until enough people are in, and when a night falls through, the app takes the blame. Nobody is ever rejected and nobody is ever the flake, because nobody ever asked anybody.

---

## Design principles (B)

1. **The app absorbs all rejection and all flake-blame.** Asks come from the app. Silent desires expire silently. Fell-through nights are the app's fault, out loud.
2. **A chat cannot keep a secret; we can.** The secret pool is the one mechanic the group chat is constitutionally incapable of copying. Pre-strike, no reply, count, or hint of a count is ever visible — enforced at the API layer, not the UI layer.
3. **The group is the precomputed invite list.** No audience picking, ever. Choosing who to ask is itself asker tax, plus politics. Every round goes to the whole circle.
4. **Small talk stays in the chat; Bonfire only speaks in commitments.** No free text except a kindler's one unattributed line and a venue name. Replies are in / out / later. Everything the product hears is machine-readable fuel.
5. **Absence is never displayed.** Inherited from A. The app never says who didn't reply, didn't come, or didn't confirm. Presence is celebrated by name; absence is an absence of rows.
6. **The scoreboard must not lie — in either direction.** Inherited from A. Pre-registered success criteria, founder-counted baselines, exit polls. No vanity reads.

---

## The core mechanic: the Asker

One fused mechanic (the team's ideas #1 + #2 — separately they fail: spontaneous kindling has no liquidity at N=5–15, and a prompting app with public replies is a nag). Four beats:

### 1. The Ask (rounds)

A **round** = one verb + one time window (+ optional one-line unattributed detail). Rounds open two ways:

- **Scheduled:** the app asks on the circle's cadence — default 2–3 rounds/week at instigator-chosen send windows (e.g., Tue 5pm about Thursday, Sun 11am about the week). Heuristics, not ML.
- **Kindled:** any member quietly opens a round from the circle page. Their "in" is recorded automatically and invisibly.

**Indistinguishability invariant:** scheduled and kindled rounds are byte-identical to recipients. Kindled rounds queue into the next send window so timing never leaks authorship. The `source` column exists in the DB for our analytics and is never serialized to any client. The app is the only asker anyone ever sees — that's the laundering that makes kindling rejection-proof.

Rounds go out **by SMS to every member** (the app holds all numbers — it is a true independent asker; see § Stack for why SMS is the rail, not the chat).

### 2. The Pool (secret ballot)

Replies: **in / out / later.** All replies are invisible to everyone — including the instigator, including "1 of 3 needed" progress meters (a visible count tells a tapper about everyone else's silence). The pool is dark until it strikes or dies.

- **later** = snooze: re-ask that member at T-8h if the round is still open, or nudge them to join if it has struck.

### 3. The Strike (threshold reveal)

The moment the Kth "in" lands, the match strikes — immediately, not at window close. **K = 2 by default** (configurable 2–4 per circle at creation). Rationale: two friends at dinner is a hang, and a struck match is a success for this test; the failure mode that kills faith in the mechanic is silent expiry, not easy strikes. Late joiners pile in via the broadcast.

- **Strike broadcast goes to the whole circle**, names in the firelight: *"It's ON: 🍜 Thursday 7pm. Maya and Dev are in — join?"* Anonymity protects the expression of desire, not attendance. After ignition it's a normal open invitation, and people join things in motion.
- **Silent expiry:** window closes below K → nothing happens, nobody is told, the round never existed. (We see it in the DB.) Re-asks recycle a failed verb in a later week without ever referencing the failure.
- A kindler whose round expires learns only that fewer than K−1 others were in — diffuse, and the app absorbs it.

### 4. The Hold (two tenses) — promoted from honorable mention

The Tuesday-yes-Saturday-flake disease is the enemy B exists to kill, so day-of confirmation is core, not garnish:

- Any strike **>24h before the event** automatically opens a **confirm round** at T-5h to struck participants: *"Tonight: 🍜 7pm — still in?"* (in / out).
- Confirms hold at ≥2 → event stands. Below 2 → the night is called off **with the app taking the blame**, to confirmed members only: *"Tonight thinned out — happens. I'll ask again soon."* No names, no fault.
- Sparks (same-day strikes) skip the confirm — they're already in the present tense.

---

## Day-of orchestration: the Walk-in

From T-1h the event page shows tap states: **omw** (one geolocation read → ETA minutes; we store the minutes, never the coordinates) and **here**. Struck participants see *"Maya's there · Dev 4 min out."* At T-0, anyone neither omw nor here gets one SMS with live status: *"Maya's already there."* Kills walking-in-alone anxiety — the silent tax on every plan — without live tracking.

**The "here" tap is the made-it record** (A's check-in, surviving as one tap). It feeds the ledger. During the test, founders backstop attendance truth in person (concierge calibration, same discipline as v2.1's capture rate).

---

## The Ledger and the Glow

- **Ghost ledger:** co-presence accrues to **phone numbers** from the first tap — event, venue (optional), timestamp. Confirms, not coordinates. When an act-two app exists, signup becomes "claim the map you already built" (Partiful's pattern, plus our retroactive twist). No claim flow is built for this test; the ledger just accrues, portable.
- **Return-glow (the Glow):** the circle page has a quiet *Places* tab — venues the circle has actually been, brightness ∝ visit count. *Lucali ×4* glows brighter than *that rooftop ×1*. The map rewards depth, not novelty: the repetition thesis as a single visual rule, and the third place emerges on screen by itself. No fog of war, no dark city — that drama is A's.
- **Passive instrument:** Places-tab opens are logged. If nobody opens it in three weeks, the map-pull hypothesis from the original 5-person-prototype plan gets its answer for free.

---

## Verbs

Four verbs per circle, set at creation, editable by the instigator. Defaults: **🍜 dinner · ☕ coffee · 🏃 move · 📺 couch.** Four because the test circles are real groups with real habits — a starter set the group actually uses beats eight designed ones. (The eight-verb language is act-two surface area.) Replies are in/out/later only; free text has no input field to die in, except the kindler's one unattributed line and a venue name.

---

## Identity, joining, consent

- **Identity = phone number.** No accounts, no passwords, no app install.
- **Recruiting (the only chat-paste):** instigator creates a circle, gets a link, pastes it into the existing group chat. Member taps → first name + phone + explicit consent line ("Bonfire texts you when plans strike; STOP anytime") → receives their personal tokenized link by SMS. The SMS channel is both verification and session; the token binds the device.
- After recruiting, the app never needs the chat again — asks and strikes travel by SMS directly. **Known seam:** chat members who never tap the recruit link are invisible to the app; circle coverage (joined ÷ chat members) is an ops metric, and founders nudge stragglers in person.
- Privacy posture: store ETA minutes not lat/lng; venue names only when someone types them; deletion on request, concierge-grade for the test; pre-strike secrecy enforced server-side (no API payload contains pool state).

---

## Stack

- **Web:** `apps/web` (Next.js on Vercel) — **undemoted.** v2.1 demoted it because Product A needed an installed PWA for push; B needs link pages, and Next.js link pages are exactly what we have. ⚠️ The repo pins a Next.js version with breaking changes — read `node_modules/next/dist/docs/` before writing code (per `AGENTS.md`).
- **SMS:** Twilio. At test scale (~3 circles × ~12 members × ~10 SMS/week ≈ $3–5/week), cost is noise. **SMS budget: ≤1 non-event SMS per member per day, ≤3 rounds per circle per week**, hard-capped in the sender. The asker's voice stays scarce enough to mean something (inherited from A's notification budget).
- **DB:** Supabase Postgres. All access server-side through Next.js route handlers with the service key; no client-side Supabase. Simpler than RLS for a 3-week test, and it makes the pre-strike secrecy guarantee a property of one code path.
- **Cron:** Vercel cron — send windows, expiry sweeps, confirm rounds, T-0 nudges.
- **Schema (compact):** `circles` (verb_set, k_threshold, send_windows) · `members` (circle, phone, name, token, consent) · `rounds` (verb, window, detail, **source — never serialized**, state: open/struck/expired) · `replies` (round × member, in/out/later, unique) · `events` (round, when, venue?, state: on/held/fell_through) · `attendance` (event × member: in/confirmed/omw/here — presence is a row, absence is no row) · `venues` (circle, name) · `exit_polls` · `page_views` · `sms_log` (budget enforcement).
- **`supabase/metrics-b.sql` ships with the schema, day one.** All metrics are SQL. No dashboard.

---

## Copy is product

The asker must sound like a warm friend with a match in hand — never a calendar bot, never a brand. Canonical voice, one example per SMS type:

| Moment | Message |
|---|---|
| Ask | "🍜 Thursday night — anyone? Nobody sees your answer till it's on. → [link]" |
| Strike | "It's ON: 🍜 Thursday 7pm. Maya and Dev are in — join? → [link]" |
| Hold (T-5h) | "Tonight: 🍜 7pm — still in?" |
| T-0 | "Maya's already there. Dev's 4 min out." |
| Fell through | "Tonight thinned out — happens. I'll ask again soon." |
| Exit poll (to attendees, next morning) | "Honest question: would last night have happened without this? [yes] [no]" |

First-round asks teach the secrecy explicitly ("nobody sees your answer till it's on"); later asks may drop it.

---

## The test

### Setup

- **Circles:** 2–3 real, existing friend groups (founders are instigators of their own). The founders' own 5-person circle is circle #0 (dry-run).
- **Baseline (before launch, per circle):** the instigating founder scrolls the group chat back 4 weeks and counts hangs that actually happened (≥2 members co-present, excluding obligations). Recorded in the run log before day one. This is the comparison anchor.

### Pre-registered success line — ratify before circle #1 launches

Across all circles over 3 clean weeks:

1. **≥6 struck hangs that happened** (strike + ≥2 present), median ≥1 per circle-week, **and**
2. **≥50% of struck hangs** answered "no" to the exit poll ("would tonight have happened without this?") — i.e., at least half the output is incremental, not cannibalized from the chat.

### Secondary instruments (what we learn even on a miss)

- **Reply rate** to rounds — is the asker heard? (<40% by week 2 → cadence/verbs wrong; iterate before declaring failure)
- **Silent-expiry rate** — liquidity health; expect high early, falling
- **Hold rate** (confirms ÷ early strikes) — flake-disease measurement; <50% → tighten windows
- **later → in conversion** — the two-tenses value
- **Places-tab opens** — the map-pull signal, free
- **Strike concentration** — if everything strikes between the same two people, K or circle composition needs work

### Calendar

| Dates (2026) | What |
|---|---|
| Jun 11–17 | Build the core: schema, round/pool/strike engine, SMS pipeline, tokenized links, round + event pages. **Circle #0 dry-run Jun 17–21.** |
| Jun 18–24 | Build the rest **mid-run**: hold flow, walk-in states, Places tab, metrics-b.sql, copy pass. Feature-availability dates go in the run log. |
| **Jun 22** | **All circles launch on the core engine.** Asks + pool + strike + SMS are the test; everything else can land under it. |
| Jun 22 – Jul 19 | Run (4 weeks elapsed). Founder-concierge: weekly debriefs per circle, verb/cadence/K iteration allowed and logged. |
| Jun 29 – Jul 5 | **Discounted week (July 4).** Inherits v2.1's calendar rule: a quiet holiday week is confounded signal, not failure. Excluding it, every circle gets **3 clean weeks**. |
| Week of Jul 20 | Readout against the pre-registered line. Wedge decision same week, with survey data on the table. |

### Readout decision tree

- **Pass both lines** → scale B: more circles, claim flow, act-two planning begins (§ below).
- **Strikes happen but exit polls say "would've happened anyway"** → we built a nicer poll, not an asker; interrogate verb/window design before scaling.
- **High reply rate, few strikes** → liquidity/threshold redesign (K, windows, verb fit); iterate 2 weeks.
- **Low reply rate after iteration** → the asker premise itself is in doubt for this population → revisit A on its own merits, or stop.

---

## Explicitly not building (the test's gate)

- Chat, comments, reactions, profiles, photos — any content surface
- **Per-person audience picking** (the group is the invite list — protect that)
- Public counts, progress meters, or any pre-strike pool visibility
- Streaks, guilt mechanics, any display of absence
- The fire, mortality, fog of war, torch, vouch, gate, hearth (act two — see below)
- Goals questionnaire (intent is behavior) · hearth-hours as a feature (it's an outcome the engine produces) · passport / open seat (doors between rooms that don't exist yet)
- App install, app store, push notifications (SMS is the rail)
- ML/learned scheduling (cadence heuristics are hand-set this round)

---

## Act two — the Fire, archived not killed

Product A (v2.1, in full, one directory over) remains the soul and the headline: mortality, the dark map, the torch, the vouch, the hearth. It is not v1 because it manufactures community — the expensive miracle — while B activates community that already exists, and B's engine (the asker) is A's engine too.

**Resurrection triggers, stated now so the data decides:**

1. **B works, then decays** — if activated circles' hang rate sags after novelty (weeks 6–10), that decay curve is the fire's job description: mortality + ritual as the retention layer, added with evidence instead of romance.
2. **B works and users ask for new people** — "more of this, but with people I don't know yet" is the gate + vouch's cue, and A's population enters.
3. **The ledger is the bridge** — every B circle accrues presence history to phone numbers. A's cold-start problem is fed by B's exhaust: "claim the map you already built."

Return-glow is the one piece of A's map already living inside B, on purpose. Protect it.

---

## The Cornell survey (time-bound, decided on purpose)

The senior-survey window closes **~June 15**. The wedge decision is **not** forced this week — B tests on our own circles regardless, and the wedge question belongs after the readout. But the survey is a perishable, nearly-free asset, and v2.1 dropped Cornell under **A's logic** (mortality economics, graduation churn) — reasoning B mostly voids (campus = the densest concentration of existing groups with group chats anywhere; churn is irrelevant at a 3-week timescale).

**Decision: harvest the survey without committing the wedge.** Add asker-tax questions:

1. How many times in the last month did your group chat produce an actual in-person hang?
2. Who usually asks first? How often does a "we should…" die unanswered?
3. If an app asked your group for you — and your "I'm down" stayed invisible until 2+ friends were also in — would you answer it? (describe, don't brand)

Wedge decision: week of July 20 (readout week), with B data and survey data on the table.

---

## Risks (honest)

- **The exit poll can flatter us.** Friends are kind. Counter: the question is framed bluntly, answered privately, one tap — and founders sanity-check against the chat-scrollback baseline.
- **SMS feels like spam if the voice is off.** Counter: the budget caps, the copy table is canon, and every message is either an ask or news about a live plan — never engagement bait.
- **K=2 strikes too easily and the same pair eats the product.** Counter: strike-concentration metric; K is per-circle configurable; this is a knob, not a bet.
- **The instigator quietly becomes the organizer again** (pasting links, nudging stragglers). Counter: recruiting is the only chat-paste by design; everything else travels by SMS. Watch it in debriefs.
- **Indistinguishability leaks via timing or copy.** Counter: kindled rounds queue to send windows; `source` never serialized; one code path for both.
- **We built a poll, not an asker.** The exit poll line (#2) exists precisely to catch this — cannibalized coordination is failure even if usage looks great.

---

## Changelog from v2.1

- **Product split named:** A (the Fire) archived as act two; B (the Asker) is the active build. B-first is sequencing, not pivot — the anchor ritual was always the app doing the asking.
- **Core mechanic fused:** app-prompted rounds + anonymous threshold pooling are one mechanic (separately: a nag and a dead drop-box). Indistinguishability invariant added.
- **Two tenses promoted to core** (the Hold); flake disease named as the primary enemy.
- **Stack inverted:** `apps/web` undemoted; SMS replaces push as the rail; phone number replaces email OTP as identity; no PWA, no install.
- **Mortality, fog, torch, vouch, gate, hearth: deferred** with explicit resurrection triggers.
- **Pre-registered success line + exit poll** added (intuition → evidence, as process).
- **Cornell: survey harvested with asker-tax questions; wedge decision deferred to readout** (v2.1 dropped it under A logic; B voids most of that reasoning).
- **July 4 discounted week** — the calendar rule, inherited.

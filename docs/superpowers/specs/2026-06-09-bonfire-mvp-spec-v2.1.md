# Bonfire MVP Spec — v2.1

**Last updated:** June 9, 2026
**Status:** Canonical build spec. Supersedes the v2 draft (June 9, 2026) and `2026-05-16-bonfire-mvp-design.md`.
**Companion:** `docs/superpowers/plans/2026-06-09-v2-pivot-plan.md` (kill / keep / repurpose plan for the v1 codebase).

---

## Executive summary

Social media broke community by replacing repeated real-world contact with content consumption. Loneliness is a **repetition problem**: relationships form through repeated, low-stakes co-presence with the same people in the same places — and no existing app manufactures repetition.

Bonfire's core unit is a small, gated neighborhood group (15–50 people) with one standing weekly ritual and a **mortal, collective fire**. The group's home screen is a single living flame fed by exactly one thing: bodies in the room, verified by check-ins. Heat decays. States fall from Roaring through Burning, Dimming, and Embers to Out. Roughly three weeks without a real gathering and the fire dies and the group archives — the lit map survives read-only, which is what makes dying mean something. Every other social product is engineered so you can never leave; Bonfire is the first that threatens to **end** if you don't show up in person. Mortality converts individual flakiness into collective stakes.

Around the fire, four supporting mechanics — each one comparator's working part, fixed:

- **Gate + Vouch** — FB Groups' curation without the feed. Admission only by member sponsorship.
- **Ritual + Torch** — Timeleft's cadence without the stranger reset. Same people, same night, every week; a rotating torch holder picks the venue.
- **Fog of war + Embers** — Corner's place layer without the recommendation feed. The map starts dark; venues light permanently only when the group is there together.
- **Pulse** — NomadTable's spontaneity, fixed by the gate: "I'm here for the next hour," broadcast to semi-familiar people.

No feed, no profiles, no posts, no chat. If it doesn't produce co-presence, we don't build it.

**Wedge:** WFH/hybrid professionals in one walkable NYC neighborhood — people who lost ambient workplace community and live somewhere dense enough to rebuild it.

**North star:** % of members physically with the same group 3+ times per month. The fire's heat is that metric rendered as the product.

**One sentence:** Explore alone → ember it → ignite it together → keep the fire alive.

---

## The thesis

**Bonfire makes physical presence the game resource.** Not points for showing up — showing up is the only input the system runs on. The entire "game" is played offline; the app is the scoreboard.

Corner has places but no people. Timeleft resets the cast every dinner. NomadTable is one-off events. Facebook Groups went virtual and died of content fatigue. Each had one working part; Bonfire is those four parts with the failure modes removed and a mortal fire at the center.

---

## Design principles

1. **If it doesn't produce co-presence, we don't build it.** The exclusion list (below) is product, not backlog.
2. **The scoreboard must not lie — in either direction.** Fake warmth (peppy empty states, inflated counts) is worse than a calendar. But the symmetric failure is just as fatal: lost check-ins make a warm night read cold, and a scoreboard that lies *sad* demoralizes a real community. The check-in system (§ below) exists to capture every body in the room.
3. **Blame the group, credit the person.** A collective pet suffers bystander diffusion — 25 people each assume someone else will feed it. So credit is always individual and named (*found by Maya*, the torch, "Maya's in — that's 6"), and stakes are always collective (the fire dims for everyone). **Absence is never displayed**: no out-lists, no flake records, no individual streaks. The fire celebrates presence; it never indicts a person.
4. **Darkness is correct.** The unlit map is not an empty state — it's the game board. Light is earned by co-presence only.
5. **The app transmits liveness; it cannot manufacture it.** Seeding quality beats any feature.
6. **Own ritual, presence, and memory; cede messaging.** A side-channel WhatsApp group will exist. That is expected and healthy — presence-adjacent chatter *is* community; the app just shouldn't host content. Structured taps cover the only three logistics messages that matter: running late (RSVP state), exact spot (check-in note: "back patio"), who's here (live check-in faces). We never build chat, and we never panic when the WhatsApp group appears.

---

## The core unit

A small, gated group (15–50 members) with a standing weekly ritual, anchored to one walkable neighborhood.

## The six mechanics

### 1. Gate + Vouch

- Groups capped at 50. Admission by neighborhood + shared affiliation.
- After founder seeding, the **only** way in is a vouch: an existing member sponsors one person. No applications, no browsing, no discovery surface. Every new face arrives pre-attached to a familiar one.
- **Vouch scarcity:** max 2 outstanding (pending) vouches per member; codes are single-use and expire after 14 days. Same philosophy as embers — scarcity is what makes sponsorship mean something.
- Honest note on the gate: wedge #1's "shared affiliation" (WFH professional) is a circumstance, not an identity. Neighborhood plus founder judgment do the real curation until vertical #2's stronger identity gates.
- Growth math, stated plainly: at 5–8% monthly churn (moves, RTO mandates, life), a 25-person group needs 2–4 successful vouches per month just to stay flat. The founder keeps seeding for months. That's the plan, not a failure of it.

### 2. Ritual (the Anchor + the Torch)

- One fixed weekly anchor: same day, same time. The app sets the cadence — no organizers, no planning, no content required to keep the group alive.
- One-tap In/Out RSVP. **Window opens T-48h** (a "yes" given weeks ago is a calendar zombie; a "yes" given Tuesday night is live signal).
- **The Torch** rotates weekly among members with at least one prior anchor check-in (founder holds it until others qualify). The torch holder picks the venue — from lit territory or a glowing ember — and adds one line ("back patio, order the mortadella").
- **Torch pick deadline is T-48h, and the reveal rides the RSVP-open notification**: "Thursday 6pm at [venue] — in or out?" (One reveal moment, one decision moment — they're the same notification.)
- **Fallback:** if the torch holder hasn't picked by T-48h, the anchor defaults to the most recently lit venue and the torch passes to the next member. The ritual is mechanically unbreakable — the no-organizer promise has no single point of failure.
- Only "in" faces are ever displayed. There is no out-list (principle 3).

### 3. The Fire

- The group's home screen is a living flame — a single persistent object the whole group keeps alive. It feeds on exactly one thing: group-scoped check-ins.
- **States:** Roaring → Burning → Dimming → Embers → Out.
- **It can die.** 21 consecutive days without a gathering of 3+ group check-ins and the fire goes out; the group archives. Death is gathering-based, not heat-based — one loyal member checking in weekly keeps a coal glowing (heat above zero) but cannot prevent death. The lit map survives read-only: the map outlives the fire, which makes dying mean something.
- **Rekindle:** a revival anchor with 10+ physical check-ins relights a dead fire. Manual process for MVP — don't build the ceremony until a fire has actually died. Orphaned members of a dead group are re-seeded into other groups by hand (death triage is concierge for MVP).
- Heat recomputes **immediately on every check-in** (so "It roared last night: 12 of you" goes out the same night), with full decay and state evaluation once daily at a fixed hour. **State changes are announced only on the confirmed daily transition** — the fire never flaps.
- Notifications come from the fire, not the calendar: "The fire is dimming — Thursday matters." / "It roared last night: 12 of you."

#### Heat formula — initial values (open decision #2, resolved to a starting point)

- Each group-scoped check-in contributes weight 1.0, decaying exponentially with a **4-day half-life**. Heat is normalized by member count.
- **Thresholds (normalized):** Roaring ≥ 0.28 · N · Burning ≥ 0.10 · N · Dimming ≥ 0.04 · N · Embers > 0 · Out by the 21-day hard rule only.
- Why these numbers — each state maps onto anchor outcomes, which is what makes fire notifications truthful:
  - A healthy anchor (~40% of a 25-person group) produces **~2 days of Roaring** (≈4 days at steady weekly cadence — the fire roars through the weekend) and keeps the fire **Burning through the following anchor**.
  - **One missed Thursday → Dimming by Sunday/Monday.** "The fire is dimming — Thursday matters" fires exactly when it's true — never as wallpaper, never as a cry-wolf.
  - **A second missed Thursday → Embers midweek.** A third → Out (the hard rule).
  - A 3-person pulse adds ~0.12 normalized — **between-anchor spontaneity visibly stokes a dimming fire.**
- Constants live in one config row. Calibrate against the alpha group's measured check-in capture rate before group #1 (see § check-in system).

### 4. Fog of war — two map layers

- **Personal map (My Map):** private. Lights up wherever *you* check in, solo or with a group. Single-player exploration — you're charting your own city. No broadcast, ever.
- **Group map:** the neighborhood starts **dark**. A venue lights permanently only when the group is there together — an anchor or pulse with 3+ check-ins. Credited forever: *Lit March 12 · found by Maya.*
- **Credit rule:** `found_by` goes to the *introducer* — the ember dropper if ignited from an ember; else the torch holder who picked it; else the pulse starter. Spots travel through people, and the credit travels with them.
- Territory = a record of nights that actually happened. Six months in, the map is a memory object, not a directory.
- Solves cold start: no seeded venue data shown. Darkness is the correct starting state; lighting it up is the product.

### 5. Embers

- The bridge between solo and group. From your personal map, drop an **ember** into any group you belong to: a faint glowing flag on the dark map + one line on why.
- Solo visits never light the group map (that would rebuild Corner — a recommendation feed in map costume). Embers only **ignite** through co-presence: the torch holder picks it, or a pulse there draws 3+ check-ins.
- Unlit embers fade after 28 days. **Cap: 2 embers per member per week** — scarcity keeps each one a genuine "I'd stake a Thursday on this."
- Effect: solo exploration becomes scouting for the group. A discovery is unfinished until your people have been there with you.

### 6. Pulse

- Between anchors, any member broadcasts "I'm here for the next hour" — venue or dropped pin, optional 50-char note, expires in 90 minutes. One-tap "coming."
- **Zero-join pulses expire silently.** No public "0 came" record — only the broadcaster ever knows. Pulse's failure mode is asymmetric initiator risk (NomadTable's real killer, beyond strangers); a rejected first pulse means no second pulse.
- **Founder personally seeds pulses for the first two weeks** of any group's life.
- **Per-group `pulse_enabled` flag, default off until the group's fire first reaches Roaring.** Spontaneity among *semi-familiar* people requires the familiarity first — the same argument that defers Crossing Paths to MVP-2 half-applies to Pulse. Manual flag flip for MVP; this is not a built progression system.
- Pulses at ember venues can ignite them. Pulse check-ins feed the fire.

---

## The check-in system

Check-in is the single most important interaction — it is the fire's only food, and on an iOS PWA there is **no background location and no geofencing**, so every check-in is a manual, foreground act. Undercounting is the existential risk: ten bodies in the room recorded as four check-ins renders a warm night as a dying fire (principle 2). The system is built to close that gap:

- **One tap.** Venue auto-suggested by distance from the pre-pulled venue table; dropped-pin fallback. Soft location verify: store the distance, flag check-ins beyond ~150m, never block.
- **Anchor-time push** to everyone who RSVP'd in: "Are you at [venue]? Tap to check in."
- **Co-presence confirm:** any checked-in member taps the faces who are physically present; each tapped person gets a one-tap confirm push ("Maya says you're at Clandestino — confirm?"). Recorded with source `confirmed`. Bodies stay verified; capture rate jumps.
- **A ritual beat, not homework:** the torch holder calls "phones out" once, early in the night. Five seconds, slightly ceremonial, on-brand — a toast, not a chore.
- **Calibration:** during the concierge phase the founder counts heads at every anchor and compares against recorded check-ins. Capture rate (check-ins ÷ headcount) is the data-quality metric that the heat thresholds are tuned against.
- **Privacy invariant:** solo check-ins (`group_id IS NULL`) are visible to their owner only, forever, enforced by RLS and tested. This is the product's privacy promise — it matters more, not less, for vertical #2 (veterans, families). Pulses are the only real-time location broadcast, and they're member-initiated, group-scoped, and 90-minute-mortal; leaving or muting a group is one tap.

---

## Wedge market

**WFH/hybrid professionals in one walkable NYC neighborhood** — people who lost ambient workplace community and live somewhere dense enough to rebuild it. The two "professional" discovery segments are the same segment.

- Digital nomads: cut (too transient to form community).
- Veterans & families: vertical #2 once mechanics are proven (strong identity gate, harder distribution/density).

**Launch:** one neighborhood, 2–3 manually seeded groups of ~25. Founder is concierge-host: picks venues, holds the first torch, drops the first three embers from his own personal map, is physically in the room for the first anchors, counts heads. The software's job is to transmit liveness, not simulate it — the first six Thursdays must be genuinely warm.

---

## North star metric

**Repeat co-presence:** % of members physically with the same group 3+ times per month. Fire heat is the real-time proxy — the metric and the product are the same object.

The north star reads once a month. The weekly ops funnel underneath it:

1. **RSVP-in rate** — % of members in, per anchor
2. **Show rate** — check-ins ÷ RSVP'd-in. *The honesty metric: are yeses real?*
3. **Repeat rate** — % attending 2+ of the last 4 anchors
4. **Capture rate** (concierge phase only) — check-ins ÷ founder headcount. *The data-quality metric.*

All of it is SQL over `checkins`. **`supabase/metrics.sql` is committed next to the migrations on day one.** No dashboard for months.

---

## Platform

- **Single Expo + React Native + TypeScript codebase** → native iOS and web (react-native-web). One app, two targets. The existing `apps/web` Next.js scaffold is demoted to a marketing page or deleted — one source of truth.
- **Phase 1: web PWA** on Vercel, Safari "Add to Home Screen" (hand-onboarding 25–75 people makes the install friction manageable). Web Push works on iOS 16.4+ **only when added to home screen** — so home-screen install is a hard onboarding step, not optional.
- **Auth: 6-digit email OTP, not magic links.** A magic-link tap opens Safari, not the installed PWA — separate storage context, session stranded. `signInWithOtp` with the OTP email template; the phone-OTP screens already in the tree become email-OTP screens nearly verbatim.
- **Web push: GATE PASSED (June 10, 2026).** Spiked on day 1: hand-rolled service worker + VAPID from the Expo web export, deployed to Vercel, installed on the founder's iPhone — subscription issued by `web.push.apple.com`, sends accepted (HTTP 201), notification delivered to the device. Phase 1 is Expo-universal, decided; `apps/web` demoted. Remaining notification work is ordinary plumbing: a `push_subscriptions` table + a Supabase Edge Function sender replacing the copy/paste flow (week 2).
- **Map: platform fork of MapStage** — `@maplibre/maplibre-react-native` (native) / `maplibre-gl` (web). MapStage's public interface was already designed for this swap. Fog of war v1: Carto `dark_all` raster tiles + glow halos for lit territory — don't literally mask geometry; reads as fog of war at 10% of the effort.
- **Venues: pre-pull every POI in the neighborhood from Overpass once, via script, into `venues`** (a few hundred rows). Never call Overpass in the check-in path — it's slow, rate-limited, and check-in is the hot path. This doesn't violate "no pre-seeded venue maps": that principle is about not *showing* a directory; rows in a table aren't a directory, and darkness stays in the UI.
- **Phase 2: native iOS** via EAS/TestFlight once mechanics prove out. Same code, better push.
- Stack: Supabase + PostGIS, NativeWind, Tabler icons, coral/ember primary, flat design.
- Fire animation: **Rive** — its state-machine model maps 1:1 to fire states and one `.riv` asset runs on both iOS and web runtimes.

---

## Data model (Supabase)

| Table | Key fields & rules |
|---|---|
| `users` | name, photo (required at onboarding — faces must repeat), "ask me about" line, email-OTP auth |
| `groups` | name, neighborhood, capacity (50), `heat` (cached), `fire_state`, `pulse_enabled`, `clock_started_at` |
| `memberships` | user × group, role (member/host), `vouched_by` |
| `vouches` | voucher, invitee, group, code (single-use), status, `expires_at` (+14d); ≤2 pending per voucher |
| `anchors` | group, day-of-week, time, tz (`America/New_York` hardcoded for MVP) |
| `anchor_instances` | anchor, date, `torch_holder_id`, `venue_id` (auto-generated weekly via cron; T-48h fallback logic lives here) |
| `rsvps` | instance × user, in/out, timestamp; unique (instance, user); only "in" is ever displayed |
| `venues` | PostGIS point, name, `osm_id` (pre-pulled once from Overpass) |
| `checkins` | user, venue, timestamp, `group_id` (**null = solo** → personal map only), source (anchor/pulse/solo/confirmed), `anchor_instance_id` FK, `pulse_id` FK, `confirmed_by`, `distance_m`; **unique per (user, anchor_instance) and (user, pulse)** — nobody double-feeds the fire from one gathering |
| `embers` | group, venue, `dropped_by`, note, `expires_at` (+28d), status (glowing/ignited/faded); ≤2/member/week |
| `lit_territory` | group × venue (unique), `lit_at`, `found_by` (introducer rule), source event |
| `pulses` | user, group, venue/pin, note (50 chars), `expires_at` (90 min) |
| `pulse_joins` | pulse × user (unique) |

- **RLS invariants (tested, not just written):** solo check-ins owner-only; all group-scoped rows member-only; embers visible only to the target group; the personal map reads only your own check-ins.
- Heat recomputes on check-in insert (trigger or RPC); daily edge function handles decay, state evaluation + transition notifications, ember expiry, anchor-instance generation, torch fallback.
- `supabase/metrics.sql` ships with the schema.

---

## Screens (five)

Tab shell is three tabs — **Fire / Map / Group** — plus modals (venue detail, check-in, pulse, ember drop).

1. **Home = The Fire.** Flame visualization + state at top. Anchor card beneath: torch holder, venue (after T-48h reveal), faces of who's in, big In/Out toggle. Active pulses below. The ritual is the heartbeat; the fire owns the front door — not the map.
2. **Map.** Toggle between *My Map* (personal lit spots, private) and *Group Map* (dark basemap, lit territory glowing, embers as faint pulsing dots).
3. **Venue detail.** If lit: date, found-by credit, "the move." Buttons: *Pulse here*; *Drop ember* (shown when the venue is on your personal map but not the group's).
4. **Group.** Faces + names + ask-me-about hooks (conversation starters designed to be used in person, not browsed). Vouch button. Fire history line ("lit 14 spots since March").
5. **Onboarding.** Vouch code → name + **photo (required)** + hook → add to home screen (hard step, with hand-holding) → **light your first spot** (guided solo check-in — teaches the core verb in minute one). Notification permission asked after first RSVP, when the value is obvious.

---

## Notification logic

- **T-48h (reveal + decision in one):** "Thursday 6pm at [venue] — in or out?" One-tap from the notification.
- **Momentum deltas, not reminders:** "Maya's in — that's 6 for Thursday." Sent only at milestones (3, 6, 10, 15, quorum) — never per-RSVP.
- **Anchor-time:** "Are you at [venue]? Tap to check in." (to RSVP'd-in members only)
- **Day-of, present tense:** "3 are already there." (to RSVP'd-in members not yet checked in) The decision becomes joining something in motion, not attending a scheduled event.
- **Fire transitions:** dimming warnings (≤1/week by construction — see heat formula), roaring recaps same night or next morning ("11 of you last night — 5 Thursdays running").
- **Pulses:** broadcast to group; "coming" taps visible to the broadcaster.
- **Budget: max 2 notifications per user per day.** The fire's voice stays scarce enough to mean something.
- Absence is never mentioned in any notification. Celebration framing only.

---

## Explicitly not building

- Chat or DMs (the ritual is fixed — nothing to coordinate; chat reopens the FB Groups leak/feed failure; see principle 6 for the side-channel posture)
- Event creation UI (anchors are set; Pulse covers spontaneity) — *includes the v1 long-press event flow already in the repo; the interaction gets salvaged for Pulse/ember creation, the feature does not*
- Friend graph, follows, public anything
- Group discovery / browse
- Pre-seeded venue *maps* (darkness is the product; pre-pulled venue *rows* for check-in suggestions are fine)
- Admin UI (Supabase dashboard is the admin)
- Individual streaks, guilt mechanics, or any display of absence (collective fire only — engagement points at the room, not the app)
- Photo recaps (content production: the gateway drug to a feed)
- Conversation prompts (Timeleft needs them because everyone's a stranger; we shouldn't)
- Auto check-in via background location (impossible on a PWA, and undesirable anyway — the tap is the ritual)

---

## Build sequence (8 weeks + calendar)

| Week (2026) | Deliverable |
|---|---|
| Jun 9–15 | **Days 1–3: web-push spike** — installed iOS PWA, service worker + VAPID + edge function. Go/no-go on Expo-web vs `apps/web` fallback. Then: email-OTP auth, groups + memberships (dashboard-seeded), anchor + RSVP loop. |
| Jun 16–22 | Push pipeline: T-48h reveal+RSVP notification, milestone momentum deltas, weekly `anchor_instances` cron, torch T-48h fallback (torch assigned manually via dashboard for now). |
| Jun 23–29 | **Check-ins** (anchor/pulse/solo/confirmed): one tap, venue suggest from pre-pulled table, pin fallback, soft 150m flag, anchor-time push, co-presence confirm flow. |
| Jun 30–Jul 6 | **Fire state machine**: heat engine with initial constants, on-check-in recompute + daily evaluation, transition notifications. v1 visualization — correct states, plain visuals. **Soft alpha begins: founder's actual friends, one group, anchors + check-ins + fire only.** |
| Jul 7–13 | **Map**: dark style (Carto `dark_all`), My Map, Group Map with lit territory + glow halos. First capture-rate calibration from alpha headcounts. |
| Jul 14–20 | **Embers** (drop / ignite / fade, 2/week cap) + torch rotation UI + vouch codes (2-outstanding cap). |
| Jul 21–27 | **Pulse** broadcast/join (flag default-off until first Roaring) + Rive fire polish + fire-driven notification polish. |
| Jul 28–Aug 3 | Onboarding flow ("light your first spot"), hardening, metrics review. Alpha's map reveal lands **pre-lit with their own July history** — the memory object's best first impression. |
| August | Tune heat constants and capture-rate gaps against the alpha cohort. **No mortality clock starts in August.** |
| Week of Sep 7 | **Onboard Group #1** (post–Labor Day). Founder holds the torch, drops the first three embers, attends in person. The clock starts here. |

**The calendar rule, stated once:** an August death is confounded signal — you can't distinguish failed mechanics from the Hamptons. The first real test of mortality must not be a test of August. (This resolves most of the old "banked coals" question; revisit seasonal grace only if a healthy group later nearly dies to a calendar quirk.)

**The long pole:** the fire visual carries the whole emotional load — budget real craft. But ship the state machine *correct* (week 4) before *beautiful* (week 7). A right-but-plain fire beats a gorgeous late one.

---

## MVP-2 (deferred, deliberately)

- **Crossing Paths:** opt-in ambient presence at group spots ("2 members at Devoción right now"). Only works after faces are familiar — earn familiarity first.
- Multi-group ember carrying (launch users are in one group anyway)
- Rekindle ceremony in-product (manual until a fire actually dies)
- First Fire greeter nudges (newcomer's first anchor marked; a regular gets a "say hi" nudge)
- Widgets / Live Activities / Dynamic Island on anchor night
- Native iOS App Store release

---

## Open decisions

1. **Cornell fork** (deadline ~June 15 — decide deliberately, not by default). Decision rule: **does the survey play feed the same mechanics, or does it fork product surface?** Graduating seniors moving to NYC are "people who lost ambient institutional community" — the same loneliness mechanic as the WFH wedge, and June is a once-a-year window. If the survey is a few days' effort yielding a list of NYC-bound grads (seed pool for a future vertical), it's cheap optionality — take it. If it demands *any* product surface before group #1 exists, kill it.
2. **Heat constants** — initial values set above; calibrate against alpha capture-rate data before group #1.
3. **Seasonal grace ("banked coals")** — largely resolved by the Labor Day calendar rule; default remains real stakes.

---

## Risks (honest)

- **Mortality is brutal during cold start** — a badly seeded group dies in public. Counter: that's unambiguous signal, fast; no vanity metrics possible. The Labor Day rule keeps the signal clean.
- **The scoreboard can lie sad.** Manual check-ins on a PWA undercount real warmth; a fire that reads cold on a warm night is as fake as inflated counts and more demoralizing. Counter: the check-in system (anchor push, co-presence confirm, the phones-out beat) + capture-rate calibration.
- **Liveness can't be faked.** The UI transmits warmth; it cannot manufacture it. Seeding quality > any feature.
- **Push reliability on web PWA** is the riskiest tech dependency — Pulse and the fire's voice are worthless without it. De-risked in days 1–3, before anything else is built.
- **The side-channel.** The WhatsApp group will exist; if we pretend otherwise, it silently becomes the product. Counter: principle 6 — own ritual/presence/memory, cede messaging consciously.

---

## Changelog from v2

- **Executive summary rewritten to lead with the fire** — v2's summary described the v1 borrowed-mechanics pitch and never mentioned the fire, mortality, fog of war, or embers.
- **Check-in system promoted to its own section** (anchor-time push, co-presence confirm, phones-out ritual beat, founder headcount calibration) — closes the undercount hole that starves the fire.
- **Heat formula given concrete initial values** (4-day half-life; 0.28 / 0.10 / 0.04 normalized thresholds) chosen so each fire state maps to anchor outcomes and the dimming warning is always true; same-night recompute; transition-only announcements; death stays gathering-based.
- **Torch contradiction resolved:** pick deadline T-48h, reveal rides the RSVP-open notification ("Thursday gets a reveal" conflicted with the T-48h venue-bearing notification); auto-fallback venue + torch pass added — no weekly single point of failure.
- **Auth switched from magic link to email OTP** (magic links strand sessions outside the installed PWA).
- **Web-push spike moved from week 3 to days 1–3** as a platform go/no-go gate; Expo-universal committed, `apps/web` demoted, MapStage platform fork named.
- **Overpass moved out of the check-in path** — one-time neighborhood pre-pull.
- **Pulse hardened:** silent zero-join expiry, founder seeding, default-off until first Roaring.
- **Vouch scarcity:** 2-outstanding cap, 14-day codes; churn math acknowledged.
- **Principles added:** blame the group, credit the person; absence never displayed; the scoreboard must not lie in either direction; side-channel posture.
- **Notification budget:** ≤2/day/user, milestone-only deltas.
- **Calendar:** soft alpha (founder's friends) from week 4; group #1 onboards post–Labor Day; no mortality clock in August.
- **Schema:** check-in FKs + per-gathering uniqueness, `found_by` introducer rule, RLS invariants stated as testable promises, `metrics.sql` committed day one.
- **Build sequence resequenced:** push weeks 1–2, vouches week 6, map ships into a pre-lit alpha history.

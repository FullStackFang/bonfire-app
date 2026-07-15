# Bonfire — The System (canonical product thesis)

> Reconciled thesis, June 2026. Supersedes the v1/v2 split previously flagged in the MVP Overview.
> This document is the canonical model; the HTML files in this bundle are visual references for the parts that have been prototyped.

## What Bonfire is

Bonfire turns "I'm free" into people next to you — a real-time presence layer for **spontaneous and recurring co-presence with the people near you**. Not a feed, not an events platform, not a planner.

**The behavioral reframe:** loneliness isn't a discovery problem or an events problem — it's a **repetition problem**. Connection forms through repeated, low-stakes co-presence with the same people in the same places. Meetup treats it as discovery, Instagram as content, WhatsApp as messaging. Bonfire treats it as **behavior**, and engineers the repetition.

**Two atomic objects:**
- **The pulse** — a live micro-event ("USA vs Germany at Smithfield, 5pm"). Spontaneous, ephemeral.
- **The crew** — a durable group that forms when the same people keep showing up.

**North star:** repeat co-presence — the share of people who are physically with the **same crew 3+ times a month**. Not signups, not RSVPs, not reach.

---

## Status of the build

| Part | State |
|---|---|
| i. The pulse (spontaneous lifecycle) | **Prototyped** |
| ii. The ritual (recurring floor) | Spec only |
| iii. Matching & placement | Spec only |
| iv. The "again" engine | Spec only |
| v. Membership lifecycle | Spec only |
| vi. Dual onboarding path (app + appless) | **Prototyped** |

---

## How the v1/v2 tension resolved

The earlier MVP Overview flagged an unreconciled split between the prototypes ("v1 pulse") and a harsher repo doctrine ("v2": mortal fire, collective blame, fog-of-war map). The current thesis resolves it:

- **The appless link survives.** Gating moves to the *placement* layer (who gets routed into a forming game), not a wall on the link. The link always opens to value.
- **A ritual is not a new object.** A recurring pulse is just a pulse with "repeat" on.
- **The mortal/blame mechanic is softened.** Collective decay/shaming becomes **graceful death** — auto-pause and ask "still want this?" — never a nag or a public blame UI.
- **Both app and web are first-class** by design (dual onboarding path).

---

## The DNA (experience principles)

Everything obeys these. If a feature breaks one, it doesn't ship.

1. **Presence is a statement, not a question.** No Going/Maybe, no RSVP. No rejection surface.
2. **The app does the work; the user shows up.** Coordination/recruiting/scheduling are the app's job. Fewer taps, never more.
3. **No feed, no chat.** Nothing to scroll and decide. Conversation stays in the group chat people already use.
4. **Status, not surveillance.** Self-reported presence, never live GPS.
5. **Hyperlocal.** Closest-viable wins; for recurring things, convenience is retention.
6. **Open to value, never a wall.** A link opens straight to the live thing; the app is an upgrade, never a gate.

---

## i. The pulse — end to end (PROTOTYPED)

1. **Spark / express demand.** Start a pulse (activity + place + time, nearby suggestions pre-filled) or just say "tennis, near me" and let the system place you. Create-vs-join is invisible. Under ten seconds.
2. **Seed.** The pulse link drops into the group chat as a live card. Nobody installs anything.
3. **Gather.** People tap in, set status. Reads as forming and alive at 3–4 ("3 in, just getting going"), never "1 going, nobody coming." On spikes, the card re-surfaces in the chat.
4. **Live.** The hero moment: who's *here*, who's *on the way* (ETA), a freeform note ("got us a table, come find me"). Self-reported status + a presence ticker.
5. **Wind-down.** A quiet wrap — "that's a wrap, 6 of you made it" — which doubles as your co-presence record. A TTL closes it.
6. **Afterglow.** The link leaves a lightweight trace; the one-tap "again?" fires. A random hang becomes the seed for the next.

---

## ii. The ritual — the forced floor (SPEC)

The pulse is the spontaneous ceiling; the ritual is the guaranteed floor. Borrow Timeleft's forcing function (system-owned cadence, place + gathering pre-handled) but point it at **the same people**, so repetition builds a real crew.

A recurring pulse is a pulse with "repeat" on: activity + place + cadence + rough headcount, plus one toggle — "keep it just us" or "open up if short."

- The app **owns the cadence** and auto-spawns a fresh pulse each cycle. Nobody creates or remembers it.
- The place is a default or a small rotation — no "where should we go."
- People are summoned **opt-out, not opt-in**: "tennis tomorrow, the usual at 7, you in?" Default is you're expected. For settled regulars, presumed-in.
- **Graceful death:** if turnout decays for a few weeks, auto-pause and ask "still want this?" rather than nag.

---

## iii. Matching & placement (SPEC)

When you express demand and there's no crew yet, the system fills one — never as a public board you browse. The **category is public** (tennis); the **placement is private and curated** (slotted into a small gated game by fit).

- **Concentric, demand-gated expansion.** Rings open only if the pulse is under its size target: friends → network → matched users nearby. A pulse that fills with friends never goes public.
- **Hyperlocal-first.** Proximity is the primary signal and the only one available at cold-start. "Closest" means closest-*viable*: fill the nearest existing game before spawning a new one. Radius flexes with density (why Cornell and one NYC neighborhood are the beachheads).
- **Curated, not uncurated** (the edge over Timeleft). Match on proximity + fit (skill, vibe, age) now, and actual attendance history later — the show-up reliability signal Timeleft can't have.

---

## iv. The "again" engine (SPEC)

The bridge from a one-off pulse to a durable crew is one signal: **would hang again.**

- **One tap, after a real hang.** No notes, no CRM — the system knows you were both there.
- **Scoped for free.** You played tennis, so "again" routes that person to tennis pulses, not your book club.
- **Intensity from repetition.** Keep tapping "again," or keep showing up together, and intent escalates. Behavior overwrites the tap.
- **Mutual = a friend-match.** Both tap "again" = platonic double opt-in → lock into a crew. One-sided stays private; unrequited interest is never exposed.

This graph powers the friend-first ring, fires the **rekindle nudge** (tapped "again" but haven't seen them in a month), and makes the ritual **emerge** (enough mutual "again"s → "make this a standing Wednesday thing?").

---

## v. Pool → crew — membership that manages itself (SPEC)

A forming group runs off one signal: weekly in/out plus who actually shows.

- **Emergent, not administered.** Show up = you're in. Drift = your seat quietly reopens. Come back = welcomed. Nobody formally joins or quits.
- **Replacement is a feature early, a bug late.** Churn freely while it's a loose pool; once a core overlaps enough it **crystallizes into a crew and locks** — replacement goes rare and explicit.
- **Missed-one is not gone.** A single absence never evicts — sub a guest, keep the standing seat. Sub in, don't swap out.
- **Transparency scales with bonding.** A pool can be silent; a crew can't. New faces get a visible welcome; a lapsing regular gets a gentle "still want your spot?" before the seat reopens.
- **The creator's ongoing job is zero.** Bonfire is the permanent organizer.

---

## Contacts, enrichment & privacy (SPEC)

- **Enriched contacts** are a byproduct of use, not a CRM chore. The durable record is who you actually show up with.
- **Phone-number enrichment:** numbers normalized + hashed, matched against the user base — the same contact discovery Signal/WhatsApp use.
- **Consent is the architecture.** You only surface what you choose (set at onboarding). Private notes stay yours — never shown, never used to match. Discoverability is per-user, rate-limited against bulk enumeration. Defaults lean a notch more private than neutral.

---

## The behavioral spine (Noom, done right)

Bonfire runs a behavior-change loop on your social life — but the change is **environmental, not willpower**. It logs **one bit per real hang** ("again?") and uses it to engineer more of the right ones.

The heavy emotional message — loneliness is real, not your fault, solvable — lives in the **movement brand ("Rage Against The Social Machine") and the funnel, never in the daily app**. The app stays light: your people, Thursday tennis, the relief of a full Friday. Belonging, not the deficit.

---

## The whole arc, in one line

> Tap a link or install, see your people are out, show up, "again?", the same people nearby every week, a crew — you're not alone on a Friday.

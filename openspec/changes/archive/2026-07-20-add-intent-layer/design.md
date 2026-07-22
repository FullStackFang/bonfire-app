# add-intent-layer — Design

## Context

The repetition thesis needs two intent signals, and the codebase has one of them. The **ember** (`pulse.embers` + `pulse.ember_taps`, `lib/pulse/ember.ts`) captures activity intent — "that was fun, again" — with a proven privacy model: lazy creation on first tap, idempotent taps, silence structurally invisible (payloads are built from tap rows, so there is no data path to the untapped), co-tapper names revealed only at mutuality, tappers only. The **afterglow screen** at `/p/plan/[token]` is the capture moment: one control, five seconds, at peak warmth. **Reconnect** (`lib/pulse/reconnect.ts`) proves the derived-engine pattern: `staleCrewMates` computes recency at read time from struck co-attended plans — no materialized state, no cron — and "accept" seeds a plan through the normal proposer, never messaging anyone. **Availability** (`resolveAvailability`) is a pure resolution function whose `unknown` never blocks.

What's missing: the directed person signal ("I want to see *her* again"), and a resolver that joins the two intent types with availability into one draft-plan candidate. House doctrine, stated in three shipped specs: matching may be automatic, **sending never is** — a human always shares the link.

This change also codifies the **campfire-knowledge doctrine** (`specs/campfire-knowledge/`) — the rules that keep an intelligence layer from tipping into a dossier. The line isn't what the system knows; it's where it learned it (provenance: only acts performed on Bonfire surfaces — the attentive-friend-at-the-table test), where it shows up again (scope: crew-atomic, never a person-level aggregate), how it speaks (surfacing: improved defaults only — ranking, weighting, timing — never displayed facts, profile cards, or insight panels), and how long it lasts (decay: unconfirmed facts fade; time-bound facts auto-expire). Reconnect already honors provenance ("derived from real in-app co-presence — never a scraped address book"); this change makes the full doctrine a spec that this resolver and every future intelligence surface build against.

## Goals / Non-Goals

**Goals:**
- Person intent: one-tap, unilateral capture, mutual-only symmetric reveal, withdrawable, zero user-facing fields.
- Two-zone afterglow: the existing "do this again?" control plus tappable co-attendee faces, same five-second moment.
- Read-time intent resolver producing ranked draft-plan candidates; compound matches (activity + person intents satisfied by one plan) rank highest.
- Pull-first surfacing on the dashboard; accept → plan via the existing proposer → viewer reviews and shares.
- Codify the campfire-knowledge doctrine (provenance, crew scope, defaults-only surfacing, decay) as a capability spec, with the resolver as its first compliant consumer.

**Non-Goals:**
- Ambient capture (SMS/share-sheet/widget person-intent registration) — phase 2, spec'd as deferred, not implemented here.
- Pushing mutual-match reveals through the reconnect nudge channel — follow-up delta against `relationship-intelligence`.
- Intensity, notes, categories, or any field on the tap. The stored object is `{from, to, source_plan, timestamp}` — all intelligence lives in resurfacing, none in capture.
- Intent decay or expiry — unmatched intents wait forever, costing nothing (declared signals are withdrawable, not decaying — see D6; decay applies to *observed* knowledge, none of which is built here).
- Building the observed-knowledge corpus itself (dietary picks, activity affinities, venue preferences, availability rhythms). This change ships the `campfire-knowledge` doctrine those future changes build against, plus the first compliant consumer (the resolver) — not the corpus.
- Asker rail, mobile app, notification changes of any kind.

## Decisions

### D1 — Person intent is pair-scoped, not gathering-scoped
`pulse.person_intents (from_participant_id, to_participant_id, source_plan_id, created_at)`, primary key `(from, to)`. The ember is scoped to one gathering because the activity is the gathering; a person intent is about the *person*, so one standing row per directed pair. `source_plan_id` records where it was captured (context for the resolver's seed text), but re-tapping from a later gathering is idempotent (`on conflict do nothing`, matching `tapEmber`) — the original timestamp stands. Mutuality = both directed rows exist.
*Alternative considered:* per-gathering person intents (mirroring embers exactly) — rejected: it multiplies rows without meaning ("I want to see Kat" isn't per-event), and makes mutuality ambiguous across gatherings.

### D2 — Capture eligibility = the co-attendance proxy, both directions
A tap `A → B` is valid only when A and B both marked the winning option of the source completed plan (the same `canTapEmber` proxy, checked for both endpoints). Person intents can only be registered toward people you were actually just with — there is no browse-a-directory path, which is what keeps the object non-creepy and makes tier-0 ghosts work unchanged (their identity is the existing per-link participant row).
*Alternative considered:* allow taps toward any crew-mate — rejected for this change: it turns capture into a roster-browsing feature (Dex territory) and detaches it from the peak-warmth moment. Phase-2 ambient capture will revisit reach, deliberately.

### D3 — Reveal rules are `publicEmberFromTaps`, transposed
One pure function (`publicPersonIntent(mine, theirs, viewerId)`-shaped) behind every read path, mirroring `publicEmberFromTaps` so per-plan and batched reads cannot diverge:
- A viewer with no identity, or who has not tapped a given person: the empty shape — no count, no hint the other row exists.
- One-sided: visible only to its author, as their own standing tap ("you're in for seeing them"). The recipient sees *nothing*; an unreciprocated tap is indistinguishable from silence, forever.
- Mutual: revealed symmetrically to both — "you both wanted this" — never "they tapped first, do you agree?" (timestamps are never shown).
- API rule: responses are built from the viewer's own rows plus mutual pairs only. Untapped and one-sided-toward-viewer rows never leave the server.

### D4 — Afterglow zone two shows attendees, never their tap state
Zone two renders the co-attendees (winning-option markers, minus the viewer) as tappable faces. Attendance is mutually known (they were there), so the faces leak nothing; each face carries only the *viewer's own* tap state (tapped/untapped, withdrawable), plus a mutual badge when D3 says so. The again-engine spec's "no other controls" requirement is amended to "exactly two zones" — still no roster-of-responses, no feedback form, no decline control.

### D5 — The resolver is pure and derived; nothing materializes until accept
`resolveIntents(viewerId)` in `lib/pulse/intent-resolver.ts`, the `staleCrewMates` pattern: one read-time computation, no new tables, no cron, no timers. Inputs: the viewer's mutual embers (tap rows via `emberTapsForPlans`), mutual person intents, and `resolveAvailability` over near-term windows for the people involved. Output: ranked candidates `{people, seedIntent, sourceEmber?, suggestedWindow?}`.

Ranking: compound (a mutual ember whose co-tappers include a mutual person-intent partner) > mutual ember > mutual person intent alone; within a tier, an availability overlap ranks above none, and `unknown` availability never blocks or demotes to zero (availability spec). A person-intent-only candidate seeds the proposer with the pair and no activity — exactly how reconnect seeds today.

**Deviation from the exploration sketch:** the chat sketch said "drafting is automatic." Here candidates are computed shapes, not DB rows — a plan row is created only when the viewer accepts (via the existing proposer, landing on it to review and share). Rationale: the repo's no-materialized-state precedent, no orphan draft rows to garbage-collect, and acceptance is where human agency enters anyway. "Intent + availability + mutuality → draft plan" still holds; the draft just isn't persisted before it's wanted.

### D6 — Declared signals vs observed knowledge: two regimes, drawn explicitly
The mutual reveal ("you both wanted this") *displays a fact about a person* — apparently violating campfire Rule 3. The resolution is a categorical distinction the doctrine now states: an intent tap is a **performed signal** — a deliberate speech act whose entire purpose is its mutuality-gated reveal, like saying "we should do this again" out loud at the table. Rule 3 governs **observed knowledge** — things the system noticed rather than things a person said *in order to be heard*. Consequences: declared signals follow their own visibility specs (mutuality-gated, symmetric, withdrawable) and **do not decay** — a guilt-free timer-less seed, with withdrawal as the author's control; observed knowledge follows the doctrine (defaults-only surfacing, crew scope, decay). This line also cleanly classifies the ember: a performed signal too.
*Alternative considered:* treating everything uniformly under Rule 3 — rejected: it would forbid the mutual reveal, which is the entire payoff of the person intent, and would misread the doctrine (Dex's sin is knowing things nobody told it, not relaying what someone deliberately signaled).

### D7 — The resolver speaks through defaults, never reasons
Availability enters the resolver as an input and leaves as a *default*: the candidate's suggested window simply is Thursday; the ranking simply is right. No candidate surface states, colors, or explains another person's availability, rhythm, or preference ("Kat is free Thursday" is forbidden copy). The card shows only what the viewer co-owns — the mutual signal, the people, the shared activity — plus system-chosen defaults. There is no "why this suggestion" affordance. The intelligence is felt as good taste, never read as data.
*Note:* the resolver's inputs in this change (embers, person intents, availability) are all provenance-clean by construction — performed on Bonfire surfaces. Crew-scoping is trivially satisfied here because everything shown is co-owned by the viewer; it becomes load-bearing in future changes (dietary picks, venue preferences), which is why the doctrine is spec'd now.

### D8 — Surfacing is pull-only, on the dashboard
Resolver candidates render as a dashboard card at existing touchpoints; an intent alone — even a fresh mutual match — never generates a notification, SMS, or delivery row. The mutual-reveal moment happens on next view. The opt-in reconnect-channel nudge ("you and Kat both tapped — she's free Thursday") is the natural follow-up but is explicitly not in this change, keeping the notification posture untouched.

## Risks / Trade-offs

- **[Zone two reads as an obligation]** — faces on the afterglow could feel like a checklist ("rate your friends"). → Mitigation: zone one stays visually primary; zone-two copy is warm and skippable; no counters, no progress, no "you haven't tapped anyone" state.
- **[Mutual-reveal timing leaks order]** — if B taps and *instantly* sees "mutual," B learns A tapped first. → Accepted: this is the designed reveal ("you both wanted this"); timestamps are never displayed, so nothing beyond mutuality itself is exposed. Symmetry is preserved.
- **[Ghost-merge must move intent rows]** — tier-0 ghosts can tap; when a ghost merges into a verified identity, `person_intents.from/to` must be re-pointed like other participant references, with pair-PK collisions resolved by keeping the earliest row. → Mitigation: extend the existing ghost-merge helper + a test; called out as its own task.
- **[Pull-only surfacing delays the payoff]** — a mutual match sits unseen until someone opens the dashboard. → Accepted for the baseline: latency over noise, per house doctrine; the reconnect-channel follow-up exists precisely to close this later.
- **[Resolver fan-out cost]** — availability resolution across all mutual partners on every dashboard read. → Mitigation: candidates are capped (top N), availability is checked only for the top tier, and the whole path is a read (cacheable later if it shows up in traces).
- **[Doctrine as spec risks vagueness]** — "improved defaults, never displayed facts" could drift into judgment calls at review time. → Mitigation: the spec's scenarios pin the concrete failure modes (no attributed availability copy, no reasons panel, no fact enumeration); each future intelligence change must add its own compliance scenarios against `campfire-knowledge`.

## Open Questions

- **Availability color semantics vs Rule 3.** The shipped `availability` spec renders other people's availability *states* (green/amber/grey) on group surfaces — a displayed fact about a person, in tension with campfire Rule 3's defaults-only surfacing. It was built deliberately (C1 resolution: availability framing, not RSVP) and this change does not touch it; the resolver simply never adds a new surface of that kind. Whether the doctrine should eventually reshape group availability rendering is a founder call, out of scope here.
- Phase-2 ambient capture (inbound Twilio, "dinner w/ Kat" parsing, person resolution against the co-attendance graph) intentionally carries its open questions with it.

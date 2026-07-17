# Conflicts Register — growth story ↔ SYSTEM-THESIS DNA

> **⚠ Status (2026-07-15): `SYSTEM-THESIS.md` is NON-BINDING for the growth-story program (founder direction).** The growth story governs; the thesis DNA is no longer a constraint the build must satisfy. This dissolves the premise of C2 and C3 — they are no longer conflicts, just growth-story direction to build as drawn. **C1 remains as built (C1-C availability framing) — Phase 1 is signed off as-is and is retained by choice, not obligation.** `SYSTEM-THESIS.md` now diverges from the shipped direction and should be annotated or archived (see bottom).

The growth-story designs pull against `design/SYSTEM-THESIS.md` on three of its stated DNA principles. Originally each was an open decision holding the build to the thesis; with the thesis non-binding, they resolve toward the growth story below.

Resolution options for each: **(A) Thesis wins** — bend the build back to the DNA. **(B) Growth story wins** — implement as drawn and amend the thesis. **(C) Hybrid** — a specific middle path noted in the row.

---

## C1 — Voting on candidate times  ·  Phase 1  ·  ⛔ blocks a Phase 1 requirement

**Growth story wants:** friends open the shared link and see a menu of candidate times, then "tap the times that work for you" and "send my picks." That is multi-option selection — an RSVP/poll mechanic (Doodle-shaped).

**Thesis DNA #1 says:** *"Presence is a statement, not a question. No Going/Maybe, no RSVP. No rejection surface."* And the content voice: *"Statements, not questions… Never 'Going / Maybe / Can't', never RSVP language."*

**Why it's genuine:** the whole Phase 1 flow is built on picking among options. The thesis forbids the question-shaped, multiple-choice, rejection-exposing version of exactly that.

**Options**
- **A (thesis wins):** collapse to a single proposed time the opener commits to; friends declare one thing — "I'm in" — no menu, no "can't make any" rejection surface. The AI proposes *one best* time+place, not a ballot. Closest to Asker's existing single-time strike.
- **B (growth story wins):** keep the multi-slot pick-what-works ballot as drawn; amend DNA #1 to permit time-selection (distinct from social RSVP). Note the "Can't make any" button is a rejection surface the thesis bans — even under B, consider dropping it.
- **C (hybrid):** AI proposes a *small* set (2–3) of times; friends tap the ones that work (availability, not RSVP framing — "when can you" not "will you come"); the opener/AI locks the winner. Presence at the locked plan is still a statement ("I'm in"), never Going/Maybe. Keep credit-by-name, no out-list.

**Decision:** ✅ **RESOLVED → C (hybrid)** · 2026-07-15. Selection is framed as **availability**, not attendance; the **"can't make any" / decline control is dropped** (a rejection surface under any resolution). Presence at the locked plan stays a plain "I'm in" statement. **No `SYSTEM-THESIS.md` amendment needed** — C1-C is designed to stay inside DNA #1 (availability ≠ RSVP); if anything, add a one-line clarification to DNA #1 later noting availability-selection is permitted, RSVP is not. Reflected in `openspec/changes/add-plan-without-chat/specs/plan-coordination/spec.md` (Requirement: "Invitees mark their availability across the options").

---

## C2 — City map + literal distances  ·  Phase 2

**Growth story wants:** a "You're in Toronto" map screen and a people-nearby roster showing exact distances ("2.1 mi", "1.3 mi", "3.0 mi").

**Thesis DNA #4 says:** *"Status, not surveillance. Self-reported presence, never live GPS."* (And placement is *"hyperlocal-first… proximity is the primary signal"* — proximity is allowed as a routing signal, but not as a live per-person distance readout.)

**Why it's genuine:** rendering each friend's precise distance implies continuous location, which reads as the live-GPS surveillance the thesis rules out — even if proximity itself is a legitimate matching input.

**Options**
- **A (thesis wins):** no per-person distances, no live map. Presence is coarse/self-reported ("around this week", "here until Fri"); proximity stays a private routing signal, never displayed as meters.
- **B (growth story wins):** show the map and distances as drawn; amend DNA #4 to allow opt-in location sharing with visible distance.
- **C (hybrid):** coarse buckets ("nearby" / "across town") from self-reported or city-level location, no precise meters, no live tracking; map shows a city, not moving dots.

**Decision:** ✅ **RESOLVED → C-ish (coarse, no GPS)** · updated 2026-07-16. Initially resolved to B (build the map + distances as drawn, 2026-07-15), but at Phase-2 build-planning the founder chose the **coarse, no-GPS** model instead: no device geolocation, no per-person distances — presence is self-reported ("around this week") with an optional self-typed locale, friends-only. This lands *back near* DNA #4 ("status, not surveillance") by choice. The growth-story "2.1 mi" mockup is intentionally not built. See `openspec/changes/add-network-discovery/design.md` Decision 2.

---

## C3 — Relationship manager / "42 days" CRM  ·  Phase 3

**Growth story wants:** a proactive morning card — *"You haven't seen Sarah in 42 days. She's free this Thursday — want me to plan something?"* — i.e. per-relationship recency tracking and prompting. A relationship CRM.

**Thesis says:** *"Enriched contacts are a byproduct of use, not a CRM chore… The durable record is who you actually show up with."* The nearest sanctioned mechanic is the lighter **"again" engine** and a **rekindle nudge** ("tapped 'again' but haven't seen them in a month"), scoped to people you chose.

**Why it's genuine:** "42 days since Sarah" is precisely the relationship-accounting the thesis frames as a chore to avoid; the sanctioned version fires only off an explicit mutual "again," not passive recency surveillance of every contact.

**Options**
- **A (thesis wins):** proactive nudges fire only from the "again" graph (mutual opt-in), phrased as rekindle, never as a contact-by-contact "days since" ledger. No recency scores on people you didn't choose.
- **B (growth story wins):** full recency-based relationship intelligence across contacts as drawn; amend the thesis' contacts/CRM stance.
- **C (hybrid):** recency prompts only for people already in a crew or mutually "again"-ed; soft language, low frequency, easy off — the intelligence exists but is opt-in and scoped, not a CRM over the whole address book.

**Decision:** ✅ **RESOLVED → C-ish (scoped + opt-in)** · updated 2026-07-16. Initially B (build as drawn, 2026-07-15); at Phase-3 build-planning the founder scoped it down (mirroring the C2 softening): recency comes only from **real in-app co-presence** (never a scraped address book), the proactive nudge is an **opt-in, frequency-capped in-app card** (no push/SMS), and it's **scoped to crew-mates** (people you've chosen), not every contact. The "42 days" mechanic ships, but tighter and less CRM-y than the mockup. See `openspec/changes/add-relationship-intelligence/design.md`.

---

### Status of `SYSTEM-THESIS.md`

As of 2026-07-15 the thesis is **non-binding** for this program. All three conflicts are resolved toward the growth story (C1 → hybrid by choice; C2, C3 → as drawn). The thesis DNA principles #1 (no RSVP), #4 (no GPS), and the no-CRM contacts stance now contradict the shipped direction. **Open item:** annotate `SYSTEM-THESIS.md` with a superseded/non-binding banner, or archive it — founder to decide. Until then, this register is the source of truth for these three product questions.

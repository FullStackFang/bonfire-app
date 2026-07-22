-- Intent-layer schema (add-intent-layer): the directed "see them again" object — the person half
-- of recurrence, alongside the ember's activity half. Mirrors pulse.ember_taps: server-side only via
-- the service connection, no RLS, not in the realtime publication.

-- One standing intent per DIRECTED pair (A wants to see B). Pair-scoped, not per-gathering: "I want
-- to see Kat" is about the person, not one event, so re-tapping from a later gathering is idempotent
-- on the PK and the original timestamp stands (see lib/pulse/person-intent.ts). `source_plan_id`
-- records where the intent was captured (context for the resolver's seed), nothing more.
--
-- Privacy contract (person-intent spec, mirrors the ember): a row is revealed to NO ONE but its
-- author until the pair is mutual (both directed rows exist). A one-sided intent is indistinguishable
-- from silence to its recipient, forever — the absence of a row and a one-sided-toward-you row are
-- never surfaced anywhere, and tap order/timestamps never leave the server. Withdrawal = deleting the
-- row, which reverts any mutual reveal on both sides. All of this lives in lib/pulse/person-intent.ts;
-- the table only stores the directed edges.
create table pulse.person_intents (
  from_participant_id uuid not null references pulse.participants(id),
  to_participant_id uuid not null references pulse.participants(id),
  source_plan_id uuid not null references pulse.plans(id),
  created_at timestamptz not null default now(),
  primary key (from_participant_id, to_participant_id),
  check (from_participant_id <> to_participant_id)
);

-- Mutuality is a self-join on the reversed pair; this index keys the "who did X tap?" and
-- "who tapped X?" reads the resolver and the afterglow faces run.
create index person_intents_to_idx on pulse.person_intents (to_participant_id);

-- Restaurant pods schema (add-restaurant-pods): optional venue facts on a pulse, party size on
-- responses, and the pod sub-group primitive. All additive/nullable — existing rows and clients
-- are unaffected (null facts = feature off). Server-side only via the service connection, no RLS,
-- not in the realtime publication. Mirrors 20260612000000_pulse_schema.sql.

-- Venue facts (design D1): facts about the venue, never a gate on people. seats_cap never blocks
-- a join (over-cap is soft overflow copy only). count_needed_by drives a READ-TIME count snapshot
-- (D3 — no cron, no stored snapshot). table_called_at is the egalitarian anyone-can-tap marker
-- that someone phoned the restaurant; idempotent set, no notification. Creation-time only in v1.
alter table pulse.pulses
  add column seats_cap int check (seats_cap is null or seats_cap > 0),
  add column count_needed_by timestamptz,
  add column table_called_at timestamptz;

-- Party size (D2): guests are COUNTS, never identities — no roster row, status, or name exists
-- for a guest. Headcount = Σ(1 + party_size) over non-'out' responses, computed at read time.
alter table pulse.pulse_responses
  add column party_size int not null default 0 check (party_size >= 0 and party_size <= 3);

-- Pods (D4): a sub-group on a pulse — label + kind + optional seat cap + owner + members.
-- Anyone with the link can open one (no host role); only the owner edits/deletes (D5). seats
-- null = uncapped (walk/meetup); a set seats is the ONLY hard capacity anywhere in the pulse
-- system (a car has seats — physical fact). "pod" is a provisional product noun; DB names keep it.
create table pulse.pulse_pods (
  id uuid primary key default gen_random_uuid(),
  pulse_id uuid not null references pulse.pulses(id),
  kind text not null check (kind in ('car','walk','meetup','other')),
  label text not null check (char_length(label) <= 40),
  seats int check (seats is null or seats > 0),
  owner_participant_id uuid not null references pulse.participants(id),
  created_at timestamptz not null default now()
);
create index pulse_pods_pulse_idx on pulse.pulse_pods (pulse_id);

-- Memberships mirror the response pattern (PK pod+participant). joined_at orders the roster.
create table pulse.pulse_pod_members (
  pod_id uuid not null references pulse.pulse_pods(id) on delete cascade,
  pulse_id uuid not null references pulse.pulses(id),
  participant_id uuid not null references pulse.participants(id),
  joined_at timestamptz not null default now(),
  primary key (pod_id, participant_id)
);
-- One pod per participant per pulse: joining another pod MOVES you (atomic leave+join in the
-- repo). The denormalized pulse_id column exists exactly to make this constraint declarative.
create unique index pulse_pod_members_one_pod_idx
  on pulse.pulse_pod_members (pulse_id, participant_id);

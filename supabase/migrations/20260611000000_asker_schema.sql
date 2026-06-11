-- Asker B-test schema (spec v3.0). Isolated from v1 public tables.
-- All access is server-side via service connection; no RLS, no PostgREST exposure.
create schema if not exists asker;

create table asker.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  verb_set jsonb not null default '[{"emoji":"🍜","label":"dinner"},{"emoji":"☕","label":"coffee"},{"emoji":"🏃","label":"move"},{"emoji":"📺","label":"couch"}]',
  k_threshold int not null default 2 check (k_threshold between 2 and 4),
  -- [{askDow,askHour,verb:'rotate'|emoji,proposeDow,proposeHour}], dow 0=Sun
  cadence jsonb not null default '[{"askDow":2,"askHour":17,"verb":"rotate","proposeDow":4,"proposeHour":19},{"askDow":0,"askHour":11,"verb":"rotate","proposeDow":6,"proposeHour":11}]',
  created_at timestamptz not null default now()
);

create table asker.members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references asker.circles(id),
  name text not null,
  phone text not null, -- E.164
  token text not null unique,
  sms_consent_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  unique (circle_id, phone)
);

create table asker.rounds (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references asker.circles(id),
  verb_emoji text not null,
  verb_label text not null,
  proposed_at timestamptz not null,
  closes_at timestamptz not null,
  detail text, -- kindler's one unattributed line
  source text not null check (source in ('scheduled','kindled')), -- NEVER serialized
  state text not null default 'open' check (state in ('queued','open','struck','expired')),
  cadence_slot text, -- idempotency key for scheduled rounds, e.g. '2026-W25-t0'
  created_at timestamptz not null default now(),
  unique (circle_id, cadence_slot)
);
create index rounds_circle_state_idx on asker.rounds (circle_id, state);

create table asker.replies (
  round_id uuid not null references asker.rounds(id),
  member_id uuid not null references asker.members(id),
  answer text not null check (answer in ('in','out','later')),
  created_at timestamptz not null default now(),
  primary key (round_id, member_id)
);

create table asker.venues (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references asker.circles(id),
  name text not null,
  unique (circle_id, name)
);

create table asker.events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null unique references asker.rounds(id),
  circle_id uuid not null references asker.circles(id),
  happens_at timestamptz not null,
  venue_id uuid references asker.venues(id),
  state text not null default 'on' check (state in ('on','fell_through','done')),
  needs_hold boolean not null default false,
  hold_opened_at timestamptz,
  hold_decided_at timestamptz,
  exit_polls_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index events_circle_state_idx on asker.events (circle_id, state);

create table asker.attendance (
  event_id uuid not null references asker.events(id),
  member_id uuid not null references asker.members(id),
  state text not null check (state in ('in','confirmed','out','omw','here')),
  eta_minutes int,
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create table asker.exit_polls (
  event_id uuid not null references asker.events(id),
  member_id uuid not null references asker.members(id),
  would_have_happened boolean not null,
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create table asker.page_views (
  id bigint generated always as identity primary key,
  member_id uuid not null references asker.members(id),
  page text not null,
  created_at timestamptz not null default now()
);

create table asker.sms_log (
  id bigint generated always as identity primary key,
  member_id uuid not null references asker.members(id),
  kind text not null check (kind in ('welcome','ask','strike','hold','t0','fell_through','exit_poll','later_nudge')),
  context_id uuid not null, -- round/event/member id the message is about; dedupe key
  body text not null,
  sent_at timestamptz not null default now(),
  unique (member_id, kind, context_id)
);
create index sms_log_member_sent_idx on asker.sms_log (member_id, sent_at);

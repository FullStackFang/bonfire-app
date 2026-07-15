-- Live Pulse rail schema (the link-railed presence surface in apps/web).
-- Isolated from v1 public tables and from the asker schema. All access is server-side
-- via the service connection; no RLS, no PostgREST exposure, not in the realtime publication.
-- Mirrors supabase/migrations/20260611000000_asker_schema.sql.
create schema if not exists pulse;

-- A participant is an appless device identity: a name typed once, held by an opaque-token
-- cookie. Not an account; the token IS the identity (no HMAC). Duplicates/ghosts are expected
-- (in-app webviews drop cookies) and tolerated — never a hard "already joined".
-- Tier 1 (durable) identity: phone (E.164) + phone_verified_at set after OTP verification.
-- Tier 0 rows simply leave them null. Verifying a phone already on another row re-points the
-- device cookie to that canonical row (ghost merge); ghost rows stay orphaned.
create table pulse.participants (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  display_name text check (display_name is null or char_length(display_name) <= 40),
  phone text unique check (phone is null or char_length(phone) <= 20),
  phone_verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- A durable crew, e.g. "GREECE '26" — evolved from the container. Holds board presence,
-- a list of live pulses, and an explicit membership roster (crew_members).
-- `version` is a monotonic counter bumped on every crew-affecting write so a poll is one
-- indexed PK read returning an ETag.
create table pulse.crews (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  name text not null check (char_length(name) <= 60),
  version bigint not null default 0,
  created_by uuid not null references pulse.participants(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- An ephemeral micro-event — evolved from the spark. May be scoped to a crew (crew_id set)
-- or stand alone as a link-drop (crew_id null). Live iff closed_at is null AND
-- expires_at > now(). expires_at is an absolute instant resolved client-side from the
-- creator's timezone (never "EOD" in server UTC). client_uuid is the idempotency key
-- against double-taps over a flaky in-app connection.
create table pulse.pulses (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  crew_id uuid references pulse.crews(id),
  title text not null check (char_length(title) <= 60),
  place text not null check (char_length(place) <= 60),
  time_label text not null check (char_length(time_label) <= 30),
  expires_at timestamptz not null,
  closed_at timestamptz,
  version bigint not null default 0,
  created_by uuid not null references pulse.participants(id),
  client_uuid uuid not null,
  created_at timestamptz not null default now(),
  -- NULLS NOT DISTINCT so a standalone pulse (crew_id null) also dedupes on retry.
  unique nulls not distinct (crew_id, created_by, client_uuid)
);
-- Hot-path: the live-pulses read filters to closed_at is null and orders by expiry. The partial
-- index keeps it fast forever and dead rows never slow it (this is why no GC cron is needed).
create index pulses_active_idx on pulse.pulses (crew_id, expires_at) where closed_at is null;

-- Board presence: one-tap status + optional note, current-only (no history). Self-reported,
-- never location-derived. Upsert keyed on (crew_id, participant_id). Tier-0 usable.
create table pulse.presence (
  crew_id uuid not null references pulse.crews(id),
  participant_id uuid not null references pulse.participants(id),
  status text not null check (status in ('around','busy','away','out')),
  note text check (note is null or char_length(note) <= 80),
  updated_at timestamptz not null default now(),
  primary key (crew_id, participant_id)
);

-- Pulse responses: one-tap status + optional ETA (on "on my way") + optional note
-- (on "here"). Same surface for standalone and crew-scoped pulses. Upsert keyed on the pk.
create table pulse.pulse_responses (
  pulse_id uuid not null references pulse.pulses(id),
  participant_id uuid not null references pulse.participants(id),
  status text not null check (status in ('in','on_my_way','here','out')),
  eta_minutes int check (eta_minutes is null or (eta_minutes > 0 and eta_minutes <= 180)),
  note text check (note is null or char_length(note) <= 80),
  updated_at timestamptz not null default now(),
  primary key (pulse_id, participant_id)
);

-- One-time SMS verification codes for the phone tier. Codes are 6 digits, hashed at rest,
-- expire within 10 minutes, allow <= 5 attempts, and are single-use (consumed_at set once).
create table pulse.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (char_length(phone) <= 20),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index phone_verifications_phone_idx on pulse.phone_verifications (phone, created_at);

-- Explicit crew roster: the scope for SMS delivery and Who's-Around. Create/join are
-- verified-tier acts; leaving is a quiet delete. Never a rejection surface.
create table pulse.crew_members (
  crew_id uuid not null references pulse.crews(id),
  participant_id uuid not null references pulse.participants(id),
  joined_at timestamptz not null default now(),
  primary key (crew_id, participant_id)
);

-- Standing busy baseline: recurring weekly busy windows declared once at onboarding
-- ("When are you usually tied up?"). days_of_week uses 0=Sunday..6=Saturday. Times are
-- local wall-clock in the stored IANA timezone (captured from the browser at creation).
create table pulse.availability_baseline (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references pulse.participants(id),
  days_of_week int[] not null check (days_of_week <> '{}'),
  start_time time not null,
  end_time time not null,
  timezone text not null check (char_length(timezone) <= 64),
  label text check (label is null or char_length(label) <= 40),
  created_at timestamptz not null default now()
);
create index availability_baseline_participant_idx on pulse.availability_baseline (participant_id);

-- One-off corrections that override the baseline: "I'm free" / "I'm away", absolute
-- instants (range support for multi-day vacations), optional all_day flag + label.
create table pulse.availability_exception (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references pulse.participants(id),
  state text not null check (state in ('free','busy')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  label text check (label is null or char_length(label) <= 40),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index availability_exception_participant_idx on pulse.availability_exception (participant_id, starts_at);

-- Calendar-provider stub: no OAuth, no sync in v1. The resolve engine branches on this
-- existing but always falls through. Kept so the resolution order is real from day one.
create table pulse.calendar_source (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references pulse.participants(id),
  provider text not null check (provider in ('google','microsoft','apple')),
  created_at timestamptz not null default now()
);

-- Pulse SMS delivery log. The unique (pulse_id, recipient_participant_id) key is the dedupe
-- guard: a retry skips existing rows, so a person is never texted twice for the same pulse.
create table pulse.sms_deliveries (
  id uuid primary key default gen_random_uuid(),
  pulse_id uuid not null references pulse.pulses(id),
  recipient_participant_id uuid not null references pulse.participants(id),
  twilio_sid text check (twilio_sid is null or char_length(twilio_sid) <= 64),
  status text not null check (status in ('sent','failed','dry_run')),
  sent_at timestamptz not null default now(),
  unique (pulse_id, recipient_participant_id)
);

-- Append-only device-funnel log so the B-test is measurable (mirrors asker.page_views).
create table pulse.events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('open','name_set','status_set','pulse_create','crew_create','pulse_wrap','phone_verified','baseline_set','exception_set','sms_sent','around_view','dash_view')),
  crew_id uuid references pulse.crews(id),
  pulse_id uuid references pulse.pulses(id),
  participant_id uuid references pulse.participants(id),
  at timestamptz not null default now()
);
create index events_kind_at_idx on pulse.events (kind, at);

-- Rate-limit counter: rolling action log keyed by scope (participant / crew / ip / phone), in
-- the spirit of asker.sms_log dedupe. The API counts rows in a window before allowing a
-- create/mutate/send.
create table pulse.action_log (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('participant','crew','ip','phone')),
  scope_key text not null,
  action text not null,
  at timestamptz not null default now()
);
create index action_log_scope_at_idx on pulse.action_log (scope, scope_key, at);

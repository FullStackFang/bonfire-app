-- Plan-coordination schema (growth-story Phase 1: "make plans without the group chat").
-- Lives in the pulse rail, reusing pulse.participants for identity. Isolated from asker.*.
-- All access is server-side via the service connection; no RLS, not in the realtime publication.
-- Mirrors supabase/migrations/20260612000000_pulse_schema.sql.

-- A plan is an opener-initiated coordination object: an intent, a set of AI-proposed candidate
-- options, and (once published) a no-account shareable link. The token IS the link identity
-- (same appless model as pulses/crews). `state` gates the lifecycle:
--   proposing -> opener is reviewing AI options (creator-only, link not yet shared)
--   open      -> published; invitees can mark availability at /p/plan/{token}
--   struck    -> confirmed ("it's on"); struck_option_id is the winner
--   expired   -> closes_at passed without a strike
-- `confirm_threshold` is the analog of asker.circles.k_threshold: the count of distinct invitees
-- whose availability an option needs before the plan strikes. `version` is the monotonic poll ETag
-- (same pattern as pulse.pulses.version).
create table pulse.plans (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  creator_participant_id uuid not null references pulse.participants(id),
  intent_text text not null check (char_length(intent_text) <= 500),
  context jsonb,
  state text not null default 'proposing' check (state in ('proposing','open','struck','expired')),
  confirm_threshold int not null default 2 check (confirm_threshold > 0),
  struck_option_id uuid,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  closes_at timestamptz
);
create index plans_creator_idx on pulse.plans (creator_participant_id, created_at);

-- A candidate option the opener/AI proposes: a time, a place, or both. `starts_at` is an absolute
-- instant (resolved client-side from the opener's timezone, never "EOD" in server UTC). `venue` is
-- a small jsonb blob ({name, area}) for place/time_place kinds. `label` is a precomputed display
-- string ("Thu, May 15 · 7:00 PM") so the link view needs no server-side date formatting.
-- `ai_rank` orders the proposed set; `source` distinguishes model output from opener edits.
create table pulse.plan_options (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references pulse.plans(id),
  kind text not null check (kind in ('time','place','time_place')),
  starts_at timestamptz,
  venue jsonb,
  label text not null check (char_length(label) <= 120),
  ai_rank int not null default 0,
  ai_rationale text check (ai_rationale is null or char_length(ai_rationale) <= 200),
  source text not null default 'ai' check (source in ('ai','opener')),
  created_at timestamptz not null default now()
);
create index plan_options_plan_idx on pulse.plan_options (plan_id, ai_rank);
-- struck_option_id points into this table (declared after plan_options exists to avoid a cycle).
alter table pulse.plans
  add constraint plans_struck_option_fk foreign key (struck_option_id) references pulse.plan_options(id);

-- An availability mark: one invitee saying "I'm free for this option" (C1-C hybrid — availability,
-- never RSVP; there is no decline row, silence = no availability). One row per (option, invitee),
-- upserted so a re-tap is idempotent. participant_id is a tier-0 ghost or a verified participant;
-- picking never requires a phone. The strike counts distinct picks per option against the plan's
-- confirm_threshold (see lib/pulse/plan.ts, ported from asker.replyAndMaybeStrike).
create table pulse.plan_picks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references pulse.plans(id),
  option_id uuid not null references pulse.plan_options(id),
  participant_id uuid not null references pulse.participants(id),
  created_at timestamptz not null default now(),
  unique (option_id, participant_id)
);
create index plan_picks_plan_idx on pulse.plan_picks (plan_id);
create index plan_picks_option_idx on pulse.plan_picks (option_id);

-- Again-engine schema (close-plan-loop): the post-event recurrence layer on pulse.plans.
-- Mirrors supabase/migrations/20260716000000_pulse_plan_schema.sql: all access is server-side
-- via the service connection; no RLS, not in the realtime publication.

-- Plan lifecycle gains a post-event state: struck -> completed once the gathering has plausibly
-- ended (winning option start + 4h, or strike + 24h when the winner carries no parseable time —
-- see lib/pulse/plan.ts resolvePlanState). `struck` is no longer terminal. `struck_at` records
-- when the strike happened so timeless winners can complete on the fallback interval; existing
-- struck rows have it null and fall back to created_at, becoming completable lazily on next read.
alter table pulse.plans drop constraint plans_state_check;
alter table pulse.plans
  add constraint plans_state_check check (state in ('proposing','open','struck','expired','completed'));
alter table pulse.plans add column struck_at timestamptz;

-- The ember: standing recurrence intent scoped to ONE completed gathering (these people, this
-- activity — SYSTEM-THESIS §iv). Created lazily on the FIRST "again" tap, so no row exists for
-- un-tapped plans. `intent_snapshot` copies the plan's intent at tap time so the ember survives
-- independently of the plan.
create table pulse.embers (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references pulse.plans(id),
  intent_snapshot text not null check (char_length(intent_snapshot) <= 500),
  created_at timestamptz not null default now()
);

-- One "again" tap = one row; re-taps are idempotent via the PK. Silence is structurally
-- invisible: the absence of a row is never surfaced anywhere, and co-tapper names leave the
-- server only once the ember is mutual (>= 2 taps) and only to tappers — see lib/pulse/ember.ts.
create table pulse.ember_taps (
  ember_id uuid not null references pulse.embers(id),
  participant_id uuid not null references pulse.participants(id),
  tapped_at timestamptz not null default now(),
  primary key (ember_id, participant_id)
);

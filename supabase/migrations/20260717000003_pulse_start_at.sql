-- Pulse gains a real start instant + the creator's timezone (pulse-when-start-duration change).
-- `expires_at` is REUSED as the end instant (no rename), so the pulse now carries both ends of its
-- window: live iff closed_at is null AND start_at <= now < expires_at. Both columns are additive
-- and nullable so old and new code coexist during rollout; reads coalesce start_at -> created_at.
alter table pulse.pulses add column start_at timestamptz;
alter table pulse.pulses add column timezone text check (timezone is null or char_length(timezone) <= 64);

-- Backfill: every legacy row was effectively a "now" pulse under the old TTL model, so its start is
-- its creation instant. New rows always write start_at explicitly.
update pulse.pulses set start_at = created_at where start_at is null;

-- The live partial index (pulses_active_idx on (crew_id, expires_at) where closed_at is null) still
-- keys the hot read: expires_at remains the end instant and the "not over" filter is unchanged.
-- Distinguishing upcoming from live is a start_at <= now comparison on the already-fetched rows —
-- no new index needed.

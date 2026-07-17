-- Network presence ("who's around") — growth-story Phase 2. Coarse and self-reported: NO device
-- location, no coordinates, no distances (founder decision 2026-07-16, softening the growth-story
-- "2.1 mi" mockup back toward "status, not surveillance"). One upserted signal per participant.
--   locale        — a free-typed city/neighborhood ("Toronto", "West Village") or null; never GPS.
--   around_window — the coarse bucket the person chose; drives the roster label.
--   around_until  — when the signal lapses; the roster shows a person only while this is in the future.
-- Visibility is crew-overlap only (enforced in the read), never public. Distinct from the
-- crew-scoped pulse.presence board. Mirrors supabase/migrations/20260612000000_pulse_schema.sql.
create table pulse.around (
  participant_id uuid primary key references pulse.participants(id),
  locale text check (locale is null or char_length(locale) <= 60),
  around_window text not null check (around_window in ('now','tonight','this_week')),
  around_until timestamptz not null,
  updated_at timestamptz not null default now()
);
-- Hot-path: the roster filters to around_until > now(); the partial-free index keeps that fast.
create index around_until_idx on pulse.around (around_until);

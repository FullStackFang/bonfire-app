-- Relationship intelligence ("you haven't seen X in a while") — growth-story Phase 3. The recency
-- signal itself is DERIVED at read time from struck plans + the crew graph (no scraped address book,
-- no materialized co-presence table). This table only holds the viewer's proactivity preferences:
--   enabled       — off by default; the proactive card appears only after explicit opt-in.
--   last_shown_at — cadence cap, so suggestions stay rare (at most ~once per window).
--   muted         — participant ids the viewer never wants suggested.
-- Scoped to crew-mates (chosen people) in the read. Mirrors supabase/migrations/20260612000000_pulse_schema.sql.
create table pulse.reconnect_prefs (
  participant_id uuid primary key references pulse.participants(id),
  enabled boolean not null default false,
  last_shown_at timestamptz,
  muted uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

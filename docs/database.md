# Database

Supabase (PostgreSQL + PostGIS). Migrations in `supabase/migrations/` — apply in numeric order via `supabase db reset`. Seed: `supabase/seed.sql` (25 venues, Ithaca + NYC).

## public schema (Bonfire v2)

| Migration | Tables / RPCs |
|---|---|
| extensions | `pgcrypto`, `postgis` |
| users | Profile mirror of `auth.users`; RLS for self-read/write |
| friendships | Bidirectional (lower/higher uid pairs); `are_friends()` RPC |
| circles + circle_members | Owner-only mutations |
| venues | `geography(point)` column; `snap_to_venue(lat, lng, radius)` RPC |
| presence_events | **Core table** — `intent`, `visible_to_circle_ids`, `venue_id`, `raw_location`, `expires_at`; `visible_presence_for_me()` RPC |
| gathers + gather_responses | Invited-circle visibility |
| inbox | Denormalized, 5 item kinds |
| fan-out triggers | Auto fan-out from presence/gather inserts |
| realtime | Publication config |
| user_profile_trigger | Auto-creates `public.users` row on `auth.users` insert |

RLS enabled on all tables. Mobile app accesses via anon key + Supabase client.

## asker schema (Asker v3 B-test)

| Table | Key columns |
|---|---|
| `asker.circles` | `verb_set`, `k_threshold`, `cadence` (JSON) |
| `asker.members` | `circle_id`, `phone` (E.164), `token`, SMS consent |
| `asker.rounds` | `state` (queued/open/struck/expired), `source` (scheduled/kindled), `cadence_slot` |
| `asker.replies` | `answer` (in/out/later) |
| `asker.venues` | Per-circle venue list |
| `asker.events` | `happens_at`, `venue`, `state` (on/fell_through/done), hold logic |
| `asker.attendance` | `state` (in/confirmed/out/omw/here) |
| `asker.exit_polls` | `would_have_happened` feedback |
| `asker.page_views`, `asker.sms_log` | Analytics |

All asker schema access is server-side via service role — no client exposure.

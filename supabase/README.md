# Bonfire — Supabase

Local Postgres + RLS schema for the Bonfire app. The migrations are written to be applied via the Supabase CLI in dependency order.

## Quick start

1. Install the Supabase CLI (`brew install supabase/tap/supabase`).
2. From the repo root:

   ```bash
   supabase init        # one-time, creates supabase/config.toml
   supabase start       # spins up local Postgres + Realtime + Studio
   supabase db reset    # applies migrations and runs seed/venues.sql
   ```

3. Copy the local URL/anon key into `apps/mobile/.env.local`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://mgclzspzvxuffdhzenlr.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nY2x6c3B6dnh1ZmZkaHplbmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODk5ODIsImV4cCI6MjA5NDQ2NTk4Mn0.Dv7XTsvUcBEtmbSaVzs1ntiScu4tF9I-vKcb2HuV7i0
   ```

   The mobile app reads these on boot. When unset, the app runs on `lib/mockSeeds.ts` data so it stays usable without a backend.

## Migration order

| File | Purpose |
|---|---|
| `20260516000000_extensions.sql` | `pgcrypto` + `postgis` |
| `20260516000100_users.sql` | Profile mirror of `auth.users`, RLS |
| `20260516000200_friendships.sql` | Bidirectional friendships stored as `(lower, higher)` pairs |
| `20260516000300_circles.sql` | Circles + members, owner-only mutations |
| `20260516000400_venues.sql` | Global venue table + `snap_to_venue(lat, lng, radius)` |
| `20260516000500_presence_events.sql` | The product's core table + RLS keyed on circle visibility |
| `20260516000600_gathers.sql` | Gathers + responses, invited-circle visibility |
| `20260516000700_inbox.sql` | Denormalized inbox items |
| `20260516000800_fanout_triggers.sql` | Auto-fan-out from presence/gather inserts to inbox |
| `20260516000900_realtime.sql` | Publication for client subscriptions |
| `20260516001000_user_profile_trigger.sql` | Auto-create `public.users` row when an `auth.users` row is created |

## Auth setup (anonymous, for now)

The welcome screen calls `supabase.auth.signInAnonymously()` to skip phone OTP during MVP. Two things must be true in the Supabase dashboard:

1. **Authentication → Sign In / Up → Allow anonymous sign-ins**: toggle **on**.
2. **Authentication → URL Configuration** doesn't matter for native; anonymous sign-in is API-only.

Anonymous users get the `authenticated` role in their JWT (with `is_anonymous: true`), so all RLS policies in this schema apply to them unchanged. You can switch to phone OTP later without touching the schema — the `(auth)/phone.tsx` and `(auth)/verify.tsx` screens are still in the tree; just route to `/(auth)/phone` from welcome.

## RLS philosophy

- Every table has RLS enabled. No row is readable by an unauthenticated client.
- Presence is scoped to circle membership. The `visible_presence_for_me()` function returns the rows the current user is allowed to see — clients use it for the initial query, then subscribe to Realtime for updates.
- Inbox items are written only by service-role triggers, read only by their recipient.

## Seed data

`seed.sql` populates ~25 venues in Ithaca and NYC. This is the MVP launch radius and is the file `supabase db reset` (and the Supabase CLI seed step against a remote project) runs automatically. Replace with a real venue ingestion job before scaling.

To re-seed a remote project that was created via the dashboard, paste `seed.sql` into the SQL editor — `db reset` will wipe data.

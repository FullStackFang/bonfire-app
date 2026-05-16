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
   EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<the anon key supabase start prints>
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

## RLS philosophy

- Every table has RLS enabled. No row is readable by an unauthenticated client.
- Presence is scoped to circle membership. The `visible_presence_for_me()` function returns the rows the current user is allowed to see — clients use it for the initial query, then subscribe to Realtime for updates.
- Inbox items are written only by service-role triggers, read only by their recipient.

## Seed data

`seed/venues.sql` populates ~25 venues in Ithaca and NYC. This is the MVP launch radius. Replace with a real venue ingestion job before scaling.

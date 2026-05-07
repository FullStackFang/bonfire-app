# Bonfire — Web App Starter

This is the starter code that converts the static HTML mockup into a Next.js + TypeScript app. Drop these files into a freshly initialized Next.js project and you'll have a working pannable illustrated map with markers, simmer animations, and the bottom sheet — ready to wire up to Supabase.

## 1. Initialize Next.js in your folder

Open the terminal in your project folder (the one VS Code has open) and run:

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir false \
  --import-alias "@/*" \
  --eslint
```

Answer "no" if it asks about Turbopack — easier debugging without it for now.

## 2. Install the extra dependencies

```bash
npm install @supabase/supabase-js zustand
```

## 3. Drop these starter files into your project

The folder structure of this starter mirrors what you want in your project. Copy these into the corresponding paths (overwriting `app/page.tsx`, `app/layout.tsx`, and `app/globals.css` from the create-next-app defaults):

```
your-project/
├── app/
│   ├── layout.tsx          ← from this starter
│   ├── page.tsx            ← from this starter
│   └── globals.css         ← from this starter (replaces default)
├── components/
│   ├── map/
│   │   ├── MapView.tsx
│   │   ├── PannableMap.tsx
│   │   ├── UserMarker.tsx
│   │   └── PlanCard.tsx
│   └── sheet/
│       └── PersonSheet.tsx
├── lib/
│   ├── types.ts
│   └── mock-data.ts
├── public/
│   └── manhattan-map.jpg   ← the illustrated map background
└── .env.local              ← copy from .env.local.example, fill in values
```

## 4. Run it

```bash
npm run dev
```

Visit `http://localhost:3000` — you should see the same mockup you've been iterating on, now in React. Pan around, click markers, the bottom sheet should slide up.

## 5. Set up Supabase (next step)

When you're ready to replace mock data with real auth and presence:

1. Create a project at [supabase.com](https://app.supabase.com)
2. Settings → API → copy the URL and `anon` public key into `.env.local`
3. SQL editor → create the schema:

```sql
-- profiles: one row per user, mirrors auth.users
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  initials text,
  gradient text[2],
  created_at timestamptz default now()
);

-- presence: one row per user, upserted when they update status
create table presence (
  user_id uuid primary key references auth.users on delete cascade,
  status text check (status in ('available','out','down','place','invisible')),
  note text,
  location geography(point),
  expires_at timestamptz,
  updated_at timestamptz default now()
);

-- plans: ephemeral micro-events
create table plans (
  id uuid primary key default gen_random_uuid(),
  short_id text unique default substring(md5(random()::text), 1, 8),
  creator_id uuid references auth.users on delete cascade,
  title text,
  vibe text,
  location geography(point),
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- plan_participants: who's in
create table plan_participants (
  plan_id uuid references plans on delete cascade,
  user_id uuid references auth.users on delete cascade,
  state text default 'in',
  joined_at timestamptz default now(),
  primary key (plan_id, user_id)
);

-- pull_ups: when someone signals "I'm coming to you"
create table pull_ups (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references auth.users on delete cascade,
  to_user uuid references auth.users on delete cascade,
  created_at timestamptz default now()
);

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table presence enable row level security;
alter table plans enable row level security;
alter table plan_participants enable row level security;
alter table pull_ups enable row level security;

-- For the closed team test: authenticated users can read everyone, write themselves
create policy "anyone authed can read profiles"  on profiles  for select using (auth.role() = 'authenticated');
create policy "users update own profile"         on profiles  for update using (id = auth.uid());

create policy "anyone authed can read presence"  on presence  for select using (auth.role() = 'authenticated');
create policy "users upsert own presence"        on presence  for all    using (user_id = auth.uid());

create policy "anyone authed can read plans"     on plans     for select using (auth.role() = 'authenticated');
create policy "users create plans"               on plans     for insert with check (creator_id = auth.uid());
create policy "creator updates own plans"        on plans     for update using (creator_id = auth.uid());

-- (Tighten these when you add network layers / friend graph)
```

4. Authentication → Providers → enable "Email" with magic link
5. Replace the `MOCK_USERS` import in `MapView.tsx` with a Supabase query + realtime subscription

## File structure quick guide

- **`app/layout.tsx`** — root layout, loads Geist font from Google Fonts
- **`app/page.tsx`** — server component, just renders `<MapView />`
- **`app/globals.css`** — CSS variables (brand colors, status colors), keyframe animations (simmer, noteFloat, livePulse), Tailwind base
- **`components/map/MapView.tsx`** — top-level client component. Holds the `selectedUser` state. Composes the map, top bar, bottom bar, sheet.
- **`components/map/PannableMap.tsx`** — drag-to-pan logic. Provides drag state via React Context so child markers can suppress clicks during drag.
- **`components/map/UserMarker.tsx`** — avatar with simmer halo, status dot, optional floating note bubble.
- **`components/map/PlanCard.tsx`** — the floating ephemeral plan card.
- **`components/sheet/PersonSheet.tsx`** — bottom sheet with Pull up / Interested / Message buttons.
- **`lib/types.ts`** — `User`, `Plan`, `Status` types.
- **`lib/mock-data.ts`** — fake users + plans, replaceable with Supabase queries.

## What to build next, in order

1. **Set up Supabase project** + add env vars + run the schema above
2. **Add a Supabase client** in `lib/supabase.ts`
3. **Build the auth flow** — magic link signup/signin (one screen)
4. **Replace mock data** with a Supabase query + realtime subscription on the `presence` table
5. **Wire status setting** — modal to set your own status, writes to `presence`
6. **Plans** — create, list, join, expire
7. **Polish, deploy to Vercel** for the team test

## Migration notes from the mockup

- The static HTML's `position: fixed` markers became `position: absolute` within the canvas — important so they ride along when you pan.
- Vanilla JS pointer event handlers became React event handlers in `PannableMap.tsx`. The "drag vs tap" suppression logic is preserved exactly: a 5px movement threshold, with `wasDragging` staying true through the click event.
- The drag state is exposed via React Context (`useDragState()`) so any child marker can check it without prop drilling.
- All animations (simmer, note float, live pulse) live in `globals.css` rather than inline styles, since they depend on `@keyframes`.

## When you're ready to ship

The illustrated map is fine for the team test (everyone's in NYC). When you scale to Cornell or other cities, swap `PannableMap`'s static image background for MapLibre GL JS — the marker components, sheet, and state management all stay the same. The interface boundary is just "where do I draw the map under these markers."

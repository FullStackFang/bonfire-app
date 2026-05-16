create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('bar','restaurant','cafe','other')),
  neighborhood text,
  location geography(point, 4326) not null,
  polygon geography(polygon, 4326),
  opentable_rid text,
  resy_id text,
  created_at timestamptz not null default now()
);

create index venues_location_idx on public.venues using gist (location);
create index venues_category_idx on public.venues (category);

alter table public.venues enable row level security;

-- Venues are global; any authenticated user can read.
create policy "venues read all"
  on public.venues for select
  to authenticated
  using (true);

-- Helper: snap a lat/lng to the nearest venue within a given radius (meters).
create or replace function public.snap_to_venue(lat double precision, lng double precision, radius_m int default 60)
returns table (id uuid, name text, distance_m double precision)
language sql stable as $$
  select v.id, v.name, st_distance(v.location, st_makepoint(lng, lat)::geography)::double precision as distance_m
  from public.venues v
  where st_dwithin(v.location, st_makepoint(lng, lat)::geography, radius_m)
  order by distance_m asc
  limit 5;
$$;

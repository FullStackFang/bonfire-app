create table public.presence_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users on delete cascade,
  intent text not null check (intent in ('available_now','out_today','out_tonight')),
  visible_to_circle_ids uuid[] not null default '{}',
  venue_id uuid references public.venues,
  raw_location geography(point, 4326),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz
);

create index presence_user_active_idx on public.presence_events (user_id, expires_at) where ended_at is null;
create index presence_location_idx on public.presence_events using gist (raw_location);
create index presence_venue_idx on public.presence_events (venue_id) where ended_at is null;

alter table public.presence_events enable row level security;

-- A user can read their own events, or any event whose visible circles overlap with circles they belong to.
create policy "presence read self or visible"
  on public.presence_events for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.circle_members m
      where m.user_id = auth.uid()
        and m.circle_id = any (visible_to_circle_ids)
    )
  );

create policy "presence insert self"
  on public.presence_events for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "presence update self"
  on public.presence_events for update
  to authenticated
  using (user_id = auth.uid());

-- Used by the client to query the current presence visible to it without scanning RLS in JS.
create or replace function public.visible_presence_for_me()
returns setof public.presence_events
language sql stable security invoker as $$
  select p.*
  from public.presence_events p
  where p.ended_at is null
    and p.expires_at > now()
    and (
      p.user_id = auth.uid()
      or exists (
        select 1 from public.circle_members m
        where m.user_id = auth.uid()
          and m.circle_id = any (p.visible_to_circle_ids)
      )
    );
$$;

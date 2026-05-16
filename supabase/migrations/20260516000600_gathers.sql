create table public.gathers (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.users on delete cascade,
  title text not null,
  starts_at timestamptz,
  primary_venue_id uuid references public.venues,
  candidate_venue_ids uuid[] not null default '{}',
  invited_circle_ids uuid[] not null,
  party_size_target int,
  reservation_provider text check (reservation_provider in ('opentable','resy')),
  reservation_url text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index gathers_host_idx on public.gathers (host_id);

create table public.gather_responses (
  gather_id uuid not null references public.gathers on delete cascade,
  user_id uuid not null references public.users on delete cascade,
  response text not null check (response in ('in','maybe','out')),
  responded_at timestamptz not null default now(),
  primary key (gather_id, user_id)
);

create index gather_responses_user_idx on public.gather_responses (user_id);

alter table public.gathers enable row level security;
alter table public.gather_responses enable row level security;

-- A gather is visible if the user is host, has responded, or is a member of any invited circle.
create policy "gathers read invited"
  on public.gathers for select
  to authenticated
  using (
    auth.uid() = host_id
    or exists (
      select 1 from public.gather_responses r where r.gather_id = gathers.id and r.user_id = auth.uid()
    )
    or exists (
      select 1 from public.circle_members m
      where m.user_id = auth.uid() and m.circle_id = any (invited_circle_ids)
    )
  );

create policy "gathers insert self"
  on public.gathers for insert
  to authenticated
  with check (auth.uid() = host_id);

create policy "gathers update host"
  on public.gathers for update
  to authenticated
  using (auth.uid() = host_id);

create policy "gather_responses read invited"
  on public.gather_responses for select
  to authenticated
  using (
    exists (
      select 1 from public.gathers g
      where g.id = gather_responses.gather_id
        and (
          g.host_id = auth.uid()
          or exists (
            select 1 from public.circle_members m
            where m.user_id = auth.uid() and m.circle_id = any (g.invited_circle_ids)
          )
        )
    )
  );

create policy "gather_responses insert self"
  on public.gather_responses for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "gather_responses update self"
  on public.gather_responses for update
  to authenticated
  using (user_id = auth.uid());

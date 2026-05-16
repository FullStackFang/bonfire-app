create table public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users on delete cascade,
  name text not null,
  accent_color text not null,
  created_at timestamptz not null default now()
);

create index on public.circles (owner_id);

create table public.circle_members (
  circle_id uuid not null references public.circles on delete cascade,
  user_id uuid not null references public.users on delete cascade,
  added_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create index on public.circle_members (user_id);

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;

-- A user can see circles they own or are a member of.
create policy "circles read self"
  on public.circles for select
  to authenticated
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.circle_members m
      where m.circle_id = circles.id and m.user_id = auth.uid()
    )
  );

create policy "circles insert self"
  on public.circles for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "circles update owner"
  on public.circles for update
  to authenticated
  using (auth.uid() = owner_id);

create policy "circles delete owner"
  on public.circles for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Circle members are visible to anyone in the circle.
create policy "circle_members read in circle"
  on public.circle_members for select
  to authenticated
  using (
    exists (
      select 1 from public.circles c
      where c.id = circle_members.circle_id
        and (c.owner_id = auth.uid() or exists (
          select 1 from public.circle_members m2
          where m2.circle_id = c.id and m2.user_id = auth.uid()
        ))
    )
  );

-- Only the owner of the circle adds/removes members.
create policy "circle_members write owner"
  on public.circle_members for all
  to authenticated
  using (
    exists (
      select 1 from public.circles c
      where c.id = circle_members.circle_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.circles c
      where c.id = circle_members.circle_id and c.owner_id = auth.uid()
    )
  );

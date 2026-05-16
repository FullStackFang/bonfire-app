create table public.friendships (
  user_a uuid not null references public.users on delete cascade,
  user_b uuid not null references public.users on delete cascade,
  established_via text not null check (established_via in ('contact_match','qr','phone_search')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index on public.friendships (user_a);
create index on public.friendships (user_b);

alter table public.friendships enable row level security;

create policy "friendships read self"
  on public.friendships for select
  to authenticated
  using (auth.uid() in (user_a, user_b));

create policy "friendships insert self"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() in (user_a, user_b));

create policy "friendships delete self"
  on public.friendships for delete
  to authenticated
  using (auth.uid() in (user_a, user_b));

-- Helper: are two users friends? (used by other policies)
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.friendships
    where (user_a = least(a, b) and user_b = greatest(a, b))
  );
$$;

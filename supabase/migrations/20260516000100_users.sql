create table public.users (
  id uuid primary key references auth.users on delete cascade,
  phone_hash text unique not null,
  display_name text not null,
  letter_pair text not null check (length(letter_pair) between 1 and 2),
  avatar_color text not null,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- A user can read any user record (avatars and display names are public within the app's auth boundary).
create policy "users readable by authenticated"
  on public.users for select
  to authenticated
  using (true);

create policy "users insert self"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users update self"
  on public.users for update
  to authenticated
  using (auth.uid() = id);

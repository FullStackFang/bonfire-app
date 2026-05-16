create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users on delete cascade,
  kind text not null check (kind in ('friend_live','gather_invite','heatmap_hot','friend_arrived','milestone')),
  payload jsonb not null,
  source_event_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index inbox_recipient_created_idx on public.inbox_items (recipient_id, created_at desc);
create index inbox_recipient_unread_idx on public.inbox_items (recipient_id) where read_at is null;

alter table public.inbox_items enable row level security;

create policy "inbox read self"
  on public.inbox_items for select
  to authenticated
  using (recipient_id = auth.uid());

create policy "inbox update self"
  on public.inbox_items for update
  to authenticated
  using (recipient_id = auth.uid());

-- Inserts come from server-side functions (presence triggers etc.) running with service role.
create policy "inbox insert service"
  on public.inbox_items for insert
  to service_role
  with check (true);

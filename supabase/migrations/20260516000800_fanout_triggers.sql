-- When a presence_event is inserted, fan out friend_live and friend_arrived inbox items.
create or replace function public.fanout_presence_event() returns trigger
language plpgsql security definer as $$
declare
  recipient_id uuid;
  payload jsonb;
  kind text;
begin
  -- Build payload once.
  payload := jsonb_build_object(
    'user_id', new.user_id,
    'venue_id', new.venue_id,
    'intent', new.intent
  );

  kind := case
    when new.venue_id is not null then 'friend_arrived'
    else 'friend_live'
  end;

  for recipient_id in
    select distinct m.user_id
    from public.circle_members m
    where m.circle_id = any (new.visible_to_circle_ids)
      and m.user_id <> new.user_id
  loop
    insert into public.inbox_items (recipient_id, kind, payload, source_event_id)
    values (recipient_id, kind, payload, new.id);
  end loop;

  return new;
end;
$$;

create trigger presence_event_fanout
  after insert on public.presence_events
  for each row execute function public.fanout_presence_event();

-- When a gather is inserted, fan out gather_invite to all invited circles.
create or replace function public.fanout_gather() returns trigger
language plpgsql security definer as $$
declare
  recipient_id uuid;
begin
  for recipient_id in
    select distinct m.user_id
    from public.circle_members m
    where m.circle_id = any (new.invited_circle_ids)
      and m.user_id <> new.host_id
  loop
    insert into public.inbox_items (recipient_id, kind, payload, source_event_id)
    values (recipient_id, 'gather_invite',
            jsonb_build_object('gather_id', new.id, 'title', new.title, 'host_id', new.host_id),
            new.id);
  end loop;
  return new;
end;
$$;

create trigger gather_fanout
  after insert on public.gathers
  for each row execute function public.fanout_gather();

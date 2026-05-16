-- Enable Realtime on the tables clients subscribe to.
alter publication supabase_realtime add table public.presence_events;
alter publication supabase_realtime add table public.gather_responses;
alter publication supabase_realtime add table public.gathers;
alter publication supabase_realtime add table public.inbox_items;

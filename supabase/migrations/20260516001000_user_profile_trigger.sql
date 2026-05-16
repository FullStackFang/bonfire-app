-- When a Supabase Auth user is created, auto-create a matching public.users
-- profile row. We derive a deterministic avatar_color and letter_pair from
-- the user id so every new user has a usable identity without a separate
-- profile-setup step.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hash_int int;
  palette text[] := array['#5E7FE5','#1A9E75','#9D5BC2','#E2843D','#E2B33D','#666f7d'];
  initials text;
begin
  -- Pick a deterministic color from the palette using a hash of the new id.
  hash_int := abs(hashtext(new.id::text)) % array_length(palette, 1) + 1;

  -- Best-effort initials from name metadata, falling back to phone digits, then 'BF'.
  initials := upper(coalesce(
    nullif(substring(new.raw_user_meta_data->>'display_name' from 1 for 2), ''),
    nullif(substring(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g') from 1 for 2), ''),
    'BF'
  ));

  insert into public.users (id, phone_hash, display_name, letter_pair, avatar_color)
  values (
    new.id,
    -- phone_hash: we hash the raw phone if present; otherwise fall back to a hash of the user id.
    encode(digest(coalesce(new.phone, new.id::text), 'sha256'), 'hex'),
    coalesce(new.raw_user_meta_data->>'display_name', 'Friend ' || substring(new.id::text from 1 for 4)),
    initials,
    palette[hash_int]
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Migration 4: pick your own username at sign-up.
--
-- profiles.handle already exists (3-20 of a-z, 0-9, _; unique). Until now it
-- was always generated ("user_1a2b3c4d5e6f"). Now sign-up passes the chosen
-- username in the user's metadata, and the sign-up trigger uses it.

-- Names nobody may take (they'd look official, or clash with app pages).
create table public.reserved_usernames (name text primary key);
insert into public.reserved_usernames (name) values
  ('admin'), ('administrator'), ('support'), ('help'), ('planner'), ('autoplanner'),
  ('root'), ('system'), ('staff'), ('team'), ('official'), ('moderator'), ('mod'),
  ('security'), ('settings'), ('today'), ('week'), ('streaks'), ('friends'), ('helper'),
  ('api'), ('auth'), ('login'), ('signup'), ('null'), ('undefined'), ('anthropic'), ('claude');
alter table public.reserved_usernames enable row level security; -- no policies: nobody reads it directly

-- Is this username valid and free? Usernames are public, so anyone (even
-- before signing up) may ask. Your own current username counts as free, so
-- the Settings form doesn't call it "taken".
create function public.username_available(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(name) ~ '^[a-z0-9_]{3,20}$'
    and lower(name) !~ '^user_'
    and not exists (select 1 from public.reserved_usernames r where r.name = lower(username_available.name))
    and not exists (
      select 1 from public.profiles p
      where p.handle = lower(username_available.name) and p.id is distinct from (select auth.uid())
    )
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Sign-up: use the chosen username when it's still valid and free; otherwise
-- (someone grabbed it a split second earlier) fall back to a generated one,
-- which the user can change in Settings. Never fail the sign-up itself.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tz text := coalesce(new.raw_user_meta_data ->> 'time_zone', 'UTC');
  wanted text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  chosen text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then
    tz := 'UTC';
  end if;
  if wanted ~ '^[a-z0-9_]{3,20}$' and wanted !~ '^user_'
     and not exists (select 1 from public.reserved_usernames r where r.name = wanted)
     and not exists (select 1 from public.profiles p where p.handle = wanted) then
    chosen := wanted;
  end if;

  insert into public.profiles (id, display_name, handle)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'New user'), 50),
    chosen
  );
  insert into public.user_settings (user_id, time_zone) values (new.id, tz);
  return new;
end $$;

-- Changing your username later: same rules, enforced by the database (not
-- just the form): no reserved names, no "user_" look-alikes of generated ones.
create function public.check_handle_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.handle is distinct from old.handle then
    new.handle := lower(new.handle);
    if new.handle ~ '^user_' or exists (select 1 from public.reserved_usernames r where r.name = new.handle) then
      raise exception 'username_not_allowed' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger check_handle_change before update of handle on public.profiles
  for each row execute function public.check_handle_change();

-- Log in with a username: the server (service role only) looks up the email.
-- Not available to users, so nobody can collect other people's emails.
create function public.email_for_username(name text) returns text
language sql stable security definer set search_path = '' as $$
  select u.email from public.profiles p join auth.users u on u.id = p.id where p.handle = lower(name)
$$;
revoke all on function public.email_for_username(text) from public, anon, authenticated;
grant execute on function public.email_for_username(text) to service_role;

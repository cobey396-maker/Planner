-- Migration 3: repair accounts that are missing their profile/settings rows.
--
-- Normally the on_auth_user_created trigger makes both rows at sign-up. An
-- account created before that trigger existed (for example, signing up
-- before the first migration ran) has neither, and then every task insert
-- fails its foreign key to profiles. This backfills those accounts now and
-- adds a function the app calls if it ever finds the rows missing again.

-- Internal: create whichever of the two rows is missing for one user.
create function public.ensure_account_rows(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u record;
  tz text;
begin
  select id, email, raw_user_meta_data as meta into u from auth.users where id = uid;
  if not found then
    return;
  end if;

  tz := coalesce(u.meta ->> 'time_zone', 'UTC');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then
    tz := 'UTC';
  end if;

  insert into public.profiles (id, display_name, handle)
  values (
    u.id,
    left(coalesce(nullif(trim(u.meta ->> 'display_name'), ''), split_part(u.email, '@', 1), 'New user'), 50),
    'user_' || substr(replace(u.id::text, '-', ''), 1, 12)
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id, time_zone) values (u.id, tz)
  on conflict (user_id) do nothing;
end $$;
revoke all on function public.ensure_account_rows(uuid) from public, anon, authenticated;

-- For the signed-in user only: repair my own account.
create function public.ensure_my_account() returns void
language sql security definer set search_path = '' as $$
  select public.ensure_account_rows((select auth.uid()))
$$;
revoke all on function public.ensure_my_account() from public, anon;
grant execute on function public.ensure_my_account() to authenticated;

-- Backfill every existing account that's missing a row.
select public.ensure_account_rows(u.id)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
   or not exists (select 1 from public.user_settings s where s.user_id = u.id);

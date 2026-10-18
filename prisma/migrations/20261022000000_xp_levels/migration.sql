-- Migration 5: XP, levels, rewards and a friends leaderboard.
--
-- Rules (mirrored in lib/planner/levels.ts; tests check they agree):
--   finish a block                  +100 XP
--   finish it before 9 AM (local)   +50  ("early")
--   first finish of the day         +20 per streak day from day 2, max +200 ("streak")
--   a block ends without being done -50  ("missed"), but never below the
--                                        start of your current level
--   only the first 10 finished blocks per day earn XP (no farming)
-- All XP is written here, on the server; users can only read their ledger.

-- A block can now have several ledger rows (complete + early + streak, or missed).
drop index if exists public.points_ledger_block_id_key;
create unique index points_ledger_block_id_reason_key on public.points_ledger (block_id, reason);

-- Old 10-point awards become 100 XP, so nobody loses progress.
update public.points_ledger set points = 100, reason = 'complete' where reason = 'block_completed';

-- Cosmetics you can equip once unlocked.
alter table public.user_settings
  add column flame_style varchar(20) not null default 'classic',
  add column title varchar(30) not null default 'rookie';

-- ---------------------------------------------------------------------------
-- Levels: L1 → L2 costs 500 XP, each next level 50 more, flat 1,500 from L21.
-- ---------------------------------------------------------------------------
create function public.level_start(n integer) returns integer
language sql immutable set search_path = '' as $$
  select case
    when n <= 1 then 0
    when n <= 22 then 450 * (n - 1) + 25 * (n - 1) * n
    else 21000 + 1500 * (n - 22)
  end
$$;

create function public.level_of(xp integer) returns integer
language plpgsql immutable set search_path = '' as $$
declare
  n integer := 1;
begin
  while n < 200 and public.level_start(n + 1) <= xp loop
    n := n + 1;
  end loop;
  return n;
end $$;

-- Rewards unlocked by level (or, for the purple flame, a 10-day streak too).
create table public.rewards (
  id text primary key,
  kind text not null check (kind in ('flame', 'title')),
  level integer not null,
  streak integer
);
insert into public.rewards (id, kind, level, streak) values
  ('classic', 'flame', 1, null), ('blue', 'flame', 5, null), ('green', 'flame', 10, null),
  ('purple', 'flame', 15, 10), ('gold', 'flame', 25, null), ('rainbow', 'flame', 50, null),
  ('rookie', 'title', 1, null), ('planner', 'title', 3, null), ('on_track', 'title', 8, null),
  ('grinder', 'title', 12, null), ('time_lord', 'title', 20, null), ('legend', 'title', 35, null),
  ('mythic', 'title', 75, null);
alter table public.rewards enable row level security;
create policy "rewards: everyone reads" on public.rewards for select to authenticated using (true);
grant select on public.rewards to authenticated;

create function public.xp_total(uid uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(points), 0)::integer from public.points_ledger where user_id = uid
$$;
revoke all on function public.xp_total(uuid) from public, anon, authenticated;

/** Consecutive local days with a finished block, ending on `today`. */
create function public.streak_days(uid uuid, tz text, today date) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  d date := today;
  n integer := 0;
begin
  while exists (
    select 1 from public.blocks b
    where b.user_id = uid and b.status = 'done' and (b.completed_at at time zone tz)::date = d
  ) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end $$;
revoke all on function public.streak_days(uuid, text, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Awarding XP for a finished block, at time `at` (now() in real use; tests
-- pass other times). Internal: users go through complete_block().
-- ---------------------------------------------------------------------------
create function public.award_completion(uid uuid, block uuid, at timestamptz) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  tz text := coalesce((select time_zone from public.user_settings where user_id = uid), 'UTC');
  local_day date := (at at time zone tz)::date;
  done_today integer;
  streak integer;
  awarded integer := 0;
begin
  -- A late finish cancels that block's "missed" penalty.
  delete from public.points_ledger where block_id = block and reason = 'missed';

  select count(*) into done_today from public.points_ledger l
  where l.user_id = uid and l.reason = 'complete' and (l.created_at at time zone tz)::date = local_day;
  if done_today >= 10 then
    return 0; -- daily cap reached: the block still counts as done, just no XP
  end if;

  insert into public.points_ledger (user_id, block_id, points, reason, created_at)
  values (uid, block, 100, 'complete', at) on conflict do nothing;
  if found then awarded := awarded + 100; end if;

  if (at at time zone tz)::time < time '09:00' then
    insert into public.points_ledger (user_id, block_id, points, reason, created_at)
    values (uid, block, 50, 'early', at) on conflict do nothing;
    if found then awarded := awarded + 50; end if;
  end if;

  -- Consistency: the first finish of the day pays a bonus for the streak.
  if done_today = 0 then
    streak := public.streak_days(uid, tz, local_day);
    if streak >= 2 then
      insert into public.points_ledger (user_id, block_id, points, reason, created_at)
      values (uid, block, least(20 * streak, 200), 'streak', at) on conflict do nothing;
      if found then awarded := awarded + least(20 * streak, 200); end if;
    end if;
  end if;
  return awarded;
end $$;
revoke all on function public.award_completion(uuid, uuid, timestamptz) from public, anon, authenticated;

drop function public.complete_block(uuid);
create function public.complete_block(block uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  update public.blocks set status = 'done', completed_at = now()
  where id = block and user_id = me and status <> 'done';
  if found then
    return public.award_completion(me, block, now());
  elsif not exists (select 1 from public.blocks where id = block and user_id = me) then
    raise exception 'Block not found' using errcode = 'P0002';
  end if;
  return 0;
end $$;
revoke all on function public.complete_block(uuid) from public, anon;
grant execute on function public.complete_block(uuid) to authenticated;

-- Undo: back to planned, and take that block's XP back.
create or replace function public.uncomplete_block(block uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.blocks set status = 'planned', completed_at = null
  where id = block and user_id = auth.uid() and status = 'done';
  delete from public.points_ledger
  where block_id = block and user_id = auth.uid() and reason in ('complete', 'early', 'streak');
end $$;

-- ---------------------------------------------------------------------------
-- Missed blocks: -50 XP each, once, never below your current level's start.
-- Only blocks that ended in the last 7 days (a grace period for old ones),
-- and not "skipped" (skipping on purpose isn't missing).
-- ---------------------------------------------------------------------------
create function public.apply_missed_penalties_for(uid uuid, at timestamptz) returns table (missed integer, xp_lost integer)
language plpgsql security definer set search_path = '' as $$
declare
  b record;
  total integer := public.xp_total(uid);
  penalty integer;
begin
  missed := 0;
  xp_lost := 0;
  for b in
    select bl.id from public.blocks bl
    where bl.user_id = uid and bl.status = 'planned'
      and bl.ends_at <= at and bl.ends_at > at - interval '7 days'
      and not exists (select 1 from public.points_ledger l where l.block_id = bl.id and l.reason = 'missed')
    order by bl.ends_at
  loop
    penalty := least(50, total - public.level_start(public.level_of(total)));
    insert into public.points_ledger (user_id, block_id, points, reason, created_at)
    values (uid, b.id, -penalty, 'missed', at);
    total := total - penalty;
    missed := missed + 1;
    xp_lost := xp_lost + penalty;
  end loop;
  return next;
end $$;
revoke all on function public.apply_missed_penalties_for(uuid, timestamptz) from public, anon, authenticated;

create function public.apply_missed_penalties() returns table (missed integer, xp_lost integer)
language sql security definer set search_path = '' as $$
  select * from public.apply_missed_penalties_for((select auth.uid()), now())
$$;
revoke all on function public.apply_missed_penalties() from public, anon;
grant execute on function public.apply_missed_penalties() to authenticated;

-- ---------------------------------------------------------------------------
-- Equipping a flame or title: only ones you've unlocked (checked here, so
-- nobody can skip it by writing to the table directly).
-- ---------------------------------------------------------------------------
create function public.check_cosmetics() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  lvl integer := public.level_of(public.xp_total(new.user_id));
  best integer;
begin
  if new.flame_style is distinct from old.flame_style then
    if not exists (
      select 1 from public.rewards r where r.id = new.flame_style and r.kind = 'flame'
        and (lvl >= r.level or (r.streak is not null and public.streak_days(new.user_id, new.time_zone,
             (now() at time zone new.time_zone)::date) >= r.streak))
    ) then
      raise exception 'reward_locked' using errcode = '23514';
    end if;
  end if;
  if new.title is distinct from old.title then
    if not exists (select 1 from public.rewards r where r.id = new.title and r.kind = 'title' and lvl >= r.level) then
      raise exception 'reward_locked' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger check_cosmetics before update of flame_style, title on public.user_settings
  for each row execute function public.check_cosmetics();

-- ---------------------------------------------------------------------------
-- Leaderboard: you and your friends, XP this week and all-time.
-- ---------------------------------------------------------------------------
create function public.friends_leaderboard(week_start timestamptz)
returns table (
  id uuid, display_name text, handle text, avatar_url text, avatar_color text,
  week_xp integer, total_xp integer, level integer, title text, flame_style text, is_me boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  people as (
    select me.id from me
    union
    select case when f.requester_id = me.id then f.addressee_id else f.requester_id end
    from public.friendships f, me
    where f.status = 'accepted' and me.id in (f.requester_id, f.addressee_id)
  )
  select p.id, p.display_name::text, p.handle::text, p.avatar_url::text, p.avatar_color::text,
    coalesce((select sum(l.points) from public.points_ledger l where l.user_id = p.id and l.created_at >= week_start), 0)::integer,
    public.xp_total(p.id),
    public.level_of(public.xp_total(p.id)),
    s.title::text, s.flame_style::text,
    p.id = (select id from me)
  from people pe
  join public.profiles p on p.id = pe.id
  left join public.user_settings s on s.user_id = p.id
  where (select id from me) is not null
  order by 6 desc, 7 desc, p.display_name
$$;
revoke all on function public.friends_leaderboard(timestamptz) from public, anon;
grant execute on function public.friends_leaderboard(timestamptz) to authenticated;

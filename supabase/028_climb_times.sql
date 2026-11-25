-- Smoother Roads: Hill Climb leaderboards (the Leaderboards page, and "Submit time" in Street GPS).
-- Street GPS times a run up a hill climb and sends the result here; the site lists the best times per climb.
-- There are no accounts: Street GPS makes a random id per PC ("device") and keeps one best time per climb and vehicle
-- for it. Nobody can read the table directly: the two functions below are the only way in (the device id is never
-- shown), and they refuse times that can't be real. The admin can delete any entry.
-- Paste into the Supabase SQL Editor and run once, after 002_comments.sql. Running it again is harmless (times are kept).

-- The climbs times are accepted for. id = the area's id on the site. min_ms = the fastest time that is believed
-- (the road's length at an average of 60 m/s, 216 km/h; the real Pikes Peak record averages 42 m/s).
create table if not exists public.climbs (
  id        text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
  name      text not null,
  length_m  integer not null check (length_m > 0),
  min_ms    integer not null check (min_ms > 0)
);

insert into public.climbs (id, name, length_m, min_ms) values
  ('pikes-peak-co',        'Pikes Peak Highway',         19970, 333000),
  ('mount-washington-nh',  'Mount Washington Auto Road', 12090, 201000),
  ('mount-vesuvius-italy', 'Mount Vesuvius',             10650, 177000),
  ('mount-fuji-japan',     'Mount Fuji',                 24320, 405000)
on conflict (id) do update set name = excluded.name, length_m = excluded.length_m, min_ms = excluded.min_ms;

create table if not exists public.climb_times (
  id          uuid primary key default gen_random_uuid(),
  climb       text not null references public.climbs (id) on delete cascade,
  device      uuid not null,
  name        text not null check (char_length(name) between 2 and 20),
  ms          integer not null check (ms > 0),
  splits      integer[] not null check (array_length(splits, 1) = 3),
  vehicle     text not null default '' check (char_length(vehicle) <= 60),
  vehicle_key text generated always as (lower(vehicle)) stored,
  version     text not null default '' check (char_length(version) <= 12),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (climb, device, vehicle_key)
);

create index if not exists climb_times_board on public.climb_times (climb, ms);
create index if not exists climb_times_device on public.climb_times (device, updated_at);

alter table public.climbs enable row level security;
alter table public.climb_times enable row level security;

revoke all on public.climbs from anon, authenticated;
revoke all on public.climb_times from anon, authenticated;
grant select on public.climbs to anon, authenticated;
grant delete on public.climb_times to authenticated;

drop policy if exists "read climbs" on public.climbs;
create policy "read climbs" on public.climbs for select to anon, authenticated using (true);

-- Only the admin deletes entries (a fake time, a rude name)
drop policy if exists "admin removes climb times" on public.climb_times;
create policy "admin removes climb times" on public.climb_times
  for delete to authenticated using (public.is_admin());

-- A time from Street GPS. Keeps the device's best for this climb and vehicle; the driver name follows the newest
-- submission on all of the device's entries. Returns the entry's place on the climb's board.
create or replace function public.submit_climb_time(
  p_climb text, p_device uuid, p_name text, p_ms integer, p_splits integer[], p_vehicle text default '', p_version text default ''
)
returns table (pos bigint, total bigint, best_ms integer, improved boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.climbs%rowtype;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]+|\s+', ' ', 'g'));
  v_vehicle text := left(btrim(regexp_replace(coalesce(p_vehicle, ''), '[[:cntrl:]<>]+|\s+', ' ', 'g')), 60);
  v_version text := left(btrim(coalesce(p_version, '')), 12);
  v_old integer;
  v_improved boolean := false;
begin
  select * into c from public.climbs where id = p_climb;
  if not found then raise exception 'unknown climb' using errcode = 'P0001'; end if;
  if p_device is null then raise exception 'no device id' using errcode = 'P0001'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 20 then
    raise exception 'driver name must be 2 to 20 characters' using errcode = 'P0001';
  end if;
  if p_ms is null or p_ms < c.min_ms or p_ms > 6 * 3600 * 1000 then
    raise exception 'time not accepted' using errcode = 'P0001';
  end if;
  if p_splits is null or array_length(p_splits, 1) is distinct from 3
     or not (p_splits[1] > 0 and p_splits[1] < p_splits[2] and p_splits[2] < p_splits[3] and p_splits[3] < p_ms)
     or p_splits[1] < c.min_ms / 4 - 1000 then
    raise exception 'splits not accepted' using errcode = 'P0001';
  end if;
  -- at most one submission every 15 seconds per device (a run takes minutes)
  if exists (select 1 from public.climb_times t where t.device = p_device and t.updated_at > now() - interval '15 seconds') then
    raise exception 'too many submissions, wait a moment' using errcode = 'P0001';
  end if;

  select t.ms into v_old from public.climb_times t
   where t.climb = p_climb and t.device = p_device and t.vehicle_key = lower(v_vehicle);
  if v_old is null then
    insert into public.climb_times (climb, device, name, ms, splits, vehicle, version)
    values (p_climb, p_device, v_name, p_ms, p_splits, v_vehicle, v_version);
    v_improved := true;
  elsif p_ms < v_old then
    update public.climb_times t
       set ms = p_ms, splits = p_splits, vehicle = v_vehicle, version = v_version, created_at = now(), updated_at = now()
     where t.climb = p_climb and t.device = p_device and t.vehicle_key = lower(v_vehicle);
    v_improved := true;
  end if;
  update public.climb_times t set name = v_name, updated_at = now() where t.device = p_device;

  return query
    select (select count(*) + 1 from public.climb_times o where o.climb = p_climb and o.ms < least(p_ms, coalesce(v_old, p_ms))),
           (select count(*) from public.climb_times o where o.climb = p_climb),
           least(p_ms, coalesce(v_old, p_ms)),
           v_improved;
end;
$$;

-- A climb's board, fastest first, without the device ids. p_device (optional): marks that device's own entries.
create or replace function public.climb_board(p_climb text, p_limit integer default 100, p_device uuid default null)
returns table (pos bigint, id uuid, name text, ms integer, splits integer[], vehicle text, at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by t.ms, t.created_at), t.id, t.name, t.ms, t.splits, t.vehicle, t.created_at,
         (p_device is not null and t.device = p_device)
    from public.climb_times t
   where t.climb = p_climb
   order by t.ms, t.created_at
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.submit_climb_time(text, uuid, text, integer, integer[], text, text) from public;
revoke all on function public.climb_board(text, integer, uuid) from public;
grant execute on function public.submit_climb_time(text, uuid, text, integer, integer[], text, text) to anon, authenticated;
grant execute on function public.climb_board(text, integer, uuid) to anon, authenticated;

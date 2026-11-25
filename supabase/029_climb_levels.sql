-- Smoother Roads: race levels on the Hill Climb leaderboards. A timed run can start from the base (the full climb),
-- or from 1/4, 1/2 or 3/4 of the way up; each start point is its own level with its own board.
-- stage: 0 = full climb, 1 = from 1/4, 2 = from 1/2, 3 = from 3/4. A run has the quarter marks after its start as
-- splits (3 for the full climb, none from 3/4).
-- Paste into the Supabase SQL Editor and run once, after 028_climb_times.sql. Running it again is harmless (times are kept).

alter table public.climb_times add column if not exists stage smallint not null default 0;

alter table public.climb_times drop constraint if exists climb_times_stage_check;
alter table public.climb_times add constraint climb_times_stage_check check (stage between 0 and 3);

-- splits: 3 - stage of them (was: always 3)
alter table public.climb_times drop constraint if exists climb_times_splits_check;
alter table public.climb_times add constraint climb_times_splits_check check (cardinality(splits) = 3 - stage);

-- one best per climb, level, device and vehicle (was: per climb, device and vehicle)
alter table public.climb_times drop constraint if exists climb_times_climb_device_vehicle_key_key;
alter table public.climb_times drop constraint if exists climb_times_one_best;
alter table public.climb_times add constraint climb_times_one_best unique (climb, stage, device, vehicle_key);

drop index if exists public.climb_times_board;
create index if not exists climb_times_board2 on public.climb_times (climb, stage, ms);

-- The functions gain the level; the versions without it go (two versions would make calls ambiguous)
drop function if exists public.submit_climb_time(text, uuid, text, integer, integer[], text, text);
drop function if exists public.climb_board(text, integer, uuid);

create or replace function public.submit_climb_time(
  p_climb text, p_device uuid, p_name text, p_ms integer, p_splits integer[], p_vehicle text default '', p_version text default '',
  p_stage integer default 0
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
  v_stage integer := coalesce(p_stage, 0);
  v_splits integer[] := coalesce(p_splits, '{}');
  v_min integer;
  v_old integer;
  v_improved boolean := false;
  i integer;
begin
  select * into c from public.climbs where id = p_climb;
  if not found then raise exception 'unknown climb' using errcode = 'P0001'; end if;
  if p_device is null then raise exception 'no device id' using errcode = 'P0001'; end if;
  if v_stage < 0 or v_stage > 3 then raise exception 'unknown level' using errcode = 'P0001'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 20 then
    raise exception 'driver name must be 2 to 20 characters' using errcode = 'P0001';
  end if;
  -- the fastest time believed, for the part of the road this level covers
  v_min := (c.min_ms::bigint * (4 - v_stage) / 4)::integer;
  if p_ms is null or p_ms < v_min or p_ms > 6 * 3600 * 1000 then
    raise exception 'time not accepted' using errcode = 'P0001';
  end if;
  -- splits: one per quarter mark after the start, each later than the one before and before the finish, and the
  -- first not sooner than a quarter of the road can be driven
  if cardinality(v_splits) <> 3 - v_stage then raise exception 'splits not accepted' using errcode = 'P0001'; end if;
  for i in 1 .. cardinality(v_splits) loop
    if v_splits[i] is null or v_splits[i] >= p_ms
       or (i = 1 and v_splits[i] < c.min_ms / 4 - 1000)
       or (i > 1 and v_splits[i] <= v_splits[i - 1]) then
      raise exception 'splits not accepted' using errcode = 'P0001';
    end if;
  end loop;
  -- at most one submission every 15 seconds per device (a run takes minutes)
  if exists (select 1 from public.climb_times t where t.device = p_device and t.updated_at > now() - interval '15 seconds') then
    raise exception 'too many submissions, wait a moment' using errcode = 'P0001';
  end if;

  select t.ms into v_old from public.climb_times t
   where t.climb = p_climb and t.stage = v_stage and t.device = p_device and t.vehicle_key = lower(v_vehicle);
  if v_old is null then
    insert into public.climb_times (climb, stage, device, name, ms, splits, vehicle, version)
    values (p_climb, v_stage, p_device, v_name, p_ms, v_splits, v_vehicle, v_version);
    v_improved := true;
  elsif p_ms < v_old then
    update public.climb_times t
       set ms = p_ms, splits = v_splits, vehicle = v_vehicle, version = v_version, created_at = now(), updated_at = now()
     where t.climb = p_climb and t.stage = v_stage and t.device = p_device and t.vehicle_key = lower(v_vehicle);
    v_improved := true;
  end if;
  update public.climb_times t set name = v_name, updated_at = now() where t.device = p_device;

  return query
    select (select count(*) + 1 from public.climb_times o
             where o.climb = p_climb and o.stage = v_stage and o.ms < least(p_ms, coalesce(v_old, p_ms))),
           (select count(*) from public.climb_times o where o.climb = p_climb and o.stage = v_stage),
           least(p_ms, coalesce(v_old, p_ms)),
           v_improved;
end;
$$;

-- A climb's board at one level, fastest first, without the device ids. p_device (optional): marks that device's own entries.
create or replace function public.climb_board(p_climb text, p_stage integer default 0, p_limit integer default 100, p_device uuid default null)
returns table (pos bigint, id uuid, name text, ms integer, splits integer[], vehicle text, at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by t.ms, t.created_at), t.id, t.name, t.ms, t.splits, t.vehicle, t.created_at,
         (p_device is not null and t.device = p_device)
    from public.climb_times t
   where t.climb = p_climb and t.stage = coalesce(p_stage, 0)
   order by t.ms, t.created_at
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.submit_climb_time(text, uuid, text, integer, integer[], text, text, integer) from public;
revoke all on function public.climb_board(text, integer, integer, uuid) from public;
grant execute on function public.submit_climb_time(text, uuid, text, integer, integer[], text, text, integer) to anon, authenticated;
grant execute on function public.climb_board(text, integer, integer, uuid) to anon, authenticated;

-- tell the API about the new functions at once (otherwise it can take up to a minute)
notify pgrst, 'reload schema';

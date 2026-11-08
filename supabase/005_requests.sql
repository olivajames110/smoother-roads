-- Smoother Roads: area requests, shared by everyone.
-- Paste into the Supabase SQL Editor and run once, after 004_hide_regions.sql.
-- A request's id doubles as its area id for votes, comments, status and hiding.

create table public.area_requests (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references auth.users (id) on delete set null,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  region     text not null default '' check (char_length(region) <= 120),
  country    text not null default '' check (char_length(country) <= 60),
  icao       text not null default '' check (icao ~ '^[A-Za-z0-9]{0,8}$'),
  cat        text not null check (cat in ('city', 'town', 'airport', 'mountain', 'coastal', 'race', 'island')),
  notes      text not null default '' check (char_length(notes) <= 1000),
  lat        double precision not null check (lat between -90 and 90),
  lon        double precision not null check (lon between -180 and 180),
  radius_m   double precision check (radius_m between 100 and 100000), -- Circle requests
  points     jsonb check (points is null or (jsonb_typeof(points) = 'array'
                          and jsonb_array_length(points) between 3 and 200)), -- Outline requests: [[lat, lon], ...]
  created_at timestamptz not null default now(),
  check ((radius_m is null) <> (points is null))
);
create index area_requests_author on public.area_requests (author_id, created_at);

alter table public.area_requests enable row level security;

-- Who asked stays private: author_id isn't readable
revoke all on public.area_requests from anon, authenticated;
grant select (id, name, region, country, icao, cat, notes, lat, lon, radius_m, points, created_at)
  on public.area_requests to anon, authenticated;
grant insert (name, region, country, icao, cat, notes, lat, lon, radius_m, points)
  on public.area_requests to authenticated;
grant delete on public.area_requests to authenticated;

-- Hidden from the admin page (area_status.hidden): only admins still receive it
create policy "read visible requests" on public.area_requests
  for select to anon, authenticated using (
    public.is_admin() or not exists (
      select 1 from public.area_status s where s.area_id = area_requests.id::text and s.hidden
    )
  );

create policy "add requests" on public.area_requests
  for insert to authenticated with check (true); -- The trigger below sets who asked

create policy "admin deletes requests" on public.area_requests
  for delete to authenticated using (public.is_admin());

-- Sets the fields a visitor must not choose, and limits how fast one browser can ask
create function public.before_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_id := auth.uid();
  new.created_at := now();
  if new.author_id is null then
    raise exception 'sign-in required';
  end if;
  if not public.is_admin() and (
    (select count(*) from public.area_requests
      where author_id = new.author_id and created_at > now() - interval '10 minutes') >= 3
    or (select count(*) from public.area_requests
      where author_id = new.author_id and created_at > now() - interval '1 day') >= 10
  ) then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;

create trigger before_request_insert
  before insert on public.area_requests
  for each row execute function public.before_request();

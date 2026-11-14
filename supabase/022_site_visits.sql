-- Smoother Roads: count site visitors, never counting the admin.
-- Paste into the Supabase SQL Editor and run once, after 021_area_reviews.sql.
--
-- One row per visit (a browser tab's session). A visitor is a random id kept in that browser, so
-- "visitors" means browsers, not people. IP addresses are never stored with the visits.
--
-- Your own visits are skipped two ways:
--   1. While you're signed in as admin, nothing is logged, and the IP you're on is remembered in
--      excluded_ips. Every visit from that IP (your phone on the same wifi, a private window) is
--      then skipped too. A new home IP is picked up the next time you open the site signed in.
--   2. Remove an old IP: delete from public.excluded_ips where ip = '1.2.3.4';

create table public.site_visits (
  id         bigint generated always as identity primary key,
  visitor    uuid not null,
  referrer   text check (char_length(referrer) <= 200), -- the referring site's host, if any
  created_at timestamptz not null default now()
);
create index site_visits_created_at on public.site_visits (created_at);
alter table public.site_visits enable row level security; -- No policies: only the functions below

create table public.excluded_ips (
  ip         text primary key,
  added_at   timestamptz not null default now()
);
alter table public.excluded_ips enable row level security; -- No policies: nobody reads it

-- The caller's IP, as Supabase's gateway passes it on
create function public.request_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(btrim(split_part(coalesce(
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    current_setting('request.headers', true)::json ->> 'x-forwarded-for',
    ''), ',', 1)), '');
$$;

-- Called once per visit by the site
create function public.log_visit(visitor uuid, ref text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_ip text := public.request_ip();
begin
  if public.is_admin() then
    if caller_ip is not null then
      insert into public.excluded_ips (ip) values (caller_ip) on conflict do nothing;
    end if;
    return;
  end if;
  if caller_ip is not null and exists (select 1 from public.excluded_ips e where e.ip = caller_ip) then
    return;
  end if;
  insert into public.site_visits (visitor, referrer)
  values (log_visit.visitor, nullif(left(btrim(ref), 200), ''));
end;
$$;
revoke all on function public.log_visit(uuid, text) from public;
grant execute on function public.log_visit(uuid, text) to anon, authenticated;

-- Admin only: visits per day (in the admin's time zone), plus totals and top referrers
create function public.visit_stats(tz text default 'UTC', days int default 30)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since date := (now() at time zone tz)::date - (greatest(1, least(days, 365)) - 1);
begin
  if not public.is_admin() then
    raise exception 'admin_only';
  end if;
  return json_build_object(
    'days', (
      select coalesce(json_agg(json_build_object('day', d.day, 'visitors', coalesce(v.visitors, 0), 'visits', coalesce(v.visits, 0)) order by d.day), '[]'::json)
      from generate_series(since, (now() at time zone tz)::date, interval '1 day') as d(day)
      left join (
        select (created_at at time zone tz)::date as day, count(distinct visitor) as visitors, count(*) as visits
        from public.site_visits
        where created_at >= (since::timestamp at time zone tz)
        group by 1
      ) v on v.day = d.day::date
    ),
    'period_visitors', (select count(distinct visitor) from public.site_visits where created_at >= (since::timestamp at time zone tz)),
    'week_visitors', (select count(distinct visitor) from public.site_visits where created_at >= (((now() at time zone tz)::date - 6)::timestamp at time zone tz)),
    'total_visitors', (select count(distinct visitor) from public.site_visits),
    'total_visits', (select count(*) from public.site_visits),
    'referrers', (
      select coalesce(json_agg(r order by r.visits desc), '[]'::json)
      from (
        select referrer as host, count(*) as visits
        from public.site_visits
        where referrer is not null and created_at >= (since::timestamp at time zone tz)
        group by referrer
        order by count(*) desc
        limit 8
      ) r
    )
  );
end;
$$;
revoke all on function public.visit_stats(text, int) from public;
grant execute on function public.visit_stats(text, int) to authenticated;

-- Smoother Roads: votes on the Vote page ("Vote for what's next"), kept apart from an area's upvotes.
-- Every visitor gets 3 votes a day (the day changes at midnight UTC), at most one per area per day; a vote cast today
-- can be taken back today. Totals add up over the days.
-- Paste into the Supabase SQL Editor and run once, after 002_comments.sql. Running it again is harmless, and it
-- also upgrades the first version of this file (one vote per area, no daily limit) if that was run before.

create table if not exists public.work_votes (
  area_id    text not null check (area_id ~ '^[a-z0-9-]{1,80}$'),
  voter      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);

alter table public.work_votes add column if not exists day date not null default ((now() at time zone 'utc')::date);
alter table public.work_votes drop constraint if exists work_votes_pkey;
alter table public.work_votes add primary key (area_id, voter, day);

create index if not exists work_votes_area on public.work_votes (area_id);
create index if not exists work_votes_voter_day on public.work_votes (voter, day);

alter table public.work_votes enable row level security;

revoke all on public.work_votes from anon, authenticated;
grant select on public.work_votes to authenticated;
grant insert (area_id) on public.work_votes to authenticated;
grant delete on public.work_votes to authenticated;

drop policy if exists "read own work votes" on public.work_votes;
create policy "read own work votes" on public.work_votes
  for select to authenticated using (voter = auth.uid());

drop policy if exists "add own work vote" on public.work_votes;
create policy "add own work vote" on public.work_votes
  for insert to authenticated with check (voter = auth.uid());

-- Only today's vote can be taken back (the admin can remove any, e.g. for a deleted request)
drop policy if exists "remove own work vote" on public.work_votes;
create policy "remove own work vote" on public.work_votes
  for delete to authenticated
  using ((voter = auth.uid() and day = (now() at time zone 'utc')::date) or public.is_admin());

-- Who and when are set here, never by the visitor; the 4th vote of a day is refused
create or replace function public.before_work_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.voter := auth.uid();
  new.day := (now() at time zone 'utc')::date;
  new.created_at := now();
  if (select count(*) from public.work_votes v where v.voter = new.voter and v.day = new.day) >= 3 then
    raise exception 'daily vote limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists before_work_vote_insert on public.work_votes;
create trigger before_work_vote_insert
  before insert on public.work_votes
  for each row execute function public.before_work_vote();

-- Totals for everyone, without showing who voted
create or replace function public.work_vote_counts()
returns table (area_id text, votes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select area_id, count(*) from public.work_votes group by area_id;
$$;

revoke all on function public.work_vote_counts() from public;
grant execute on function public.work_vote_counts() to anon, authenticated;

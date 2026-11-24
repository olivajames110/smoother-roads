-- Smoother Roads: votes on the Vote page ("Vote for what's next"), kept apart from an area's upvotes.
-- An upvote on an area says "I like / want this"; a vote here says "work on this next". One per visitor per area,
-- taken back by clicking again. Same shape and rules as area_votes (001_votes.sql).
-- Paste into the Supabase SQL Editor and run once, after 002_comments.sql. Running it again is harmless.

create table if not exists public.work_votes (
  area_id    text not null check (area_id ~ '^[a-z0-9-]{1,80}$'),
  voter      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (area_id, voter)
);

create index if not exists work_votes_area on public.work_votes (area_id);

alter table public.work_votes enable row level security;

-- Each visitor sees and changes only their own votes; the admin can remove any (a deleted request)
drop policy if exists "read own work votes" on public.work_votes;
create policy "read own work votes" on public.work_votes
  for select to authenticated using (voter = auth.uid());

drop policy if exists "add own work vote" on public.work_votes;
create policy "add own work vote" on public.work_votes
  for insert to authenticated with check (voter = auth.uid());

drop policy if exists "remove own work vote" on public.work_votes;
create policy "remove own work vote" on public.work_votes
  for delete to authenticated using (voter = auth.uid() or public.is_admin());

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

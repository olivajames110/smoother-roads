-- Smoother Roads: the "vote for the next area" page.
-- Paste into the Supabase SQL Editor and run once.
--
-- Votes count in rounds. Each visitor (anonymous sign-in: one per browser) gets 3 votes a day,
-- at most one per area. A day is a UTC day, so everyone shares the same reset. When the admin
-- ends a round (and names the winner), a new one starts at zero; past winners stay listed.

create table public.vote_rounds (
  id         serial primary key,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  winner     text check (winner ~ '^[a-z0-9-]{1,80}$')
);

-- only one round open at a time
create unique index vote_rounds_one_open on public.vote_rounds ((ended_at is null)) where ended_at is null;

create table public.next_votes (
  id         bigserial primary key,
  round_id   integer not null references public.vote_rounds (id) on delete cascade,
  area_id    text not null check (area_id ~ '^[a-z0-9-]{1,80}$'),
  voter      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  unique (round_id, area_id, voter, day)   -- one vote per area per day
);

create index next_votes_round on public.next_votes (round_id, area_id);
create index next_votes_voter_day on public.next_votes (voter, day);

alter table public.vote_rounds enable row level security;
alter table public.next_votes enable row level security;
grant select on public.vote_rounds to anon, authenticated;
grant select, insert, delete on public.next_votes to authenticated;
grant usage on sequence public.next_votes_id_seq to authenticated;

create policy "read rounds" on public.vote_rounds for select to anon, authenticated using (true);

-- each visitor sees, adds and takes back (same day only) their own votes
create policy "read own next votes" on public.next_votes
  for select to authenticated using (voter = auth.uid());
create policy "add own next vote" on public.next_votes
  for insert to authenticated with check (voter = auth.uid());
create policy "take back today's vote" on public.next_votes
  for delete to authenticated using (voter = auth.uid() and day = (now() at time zone 'utc')::date);

-- the server sets the round, the day and the voter, and holds each visitor to 3 a day
create function public.before_next_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.voter := auth.uid();
  if new.voter is null then
    raise exception 'sign-in required';
  end if;
  new.day := (now() at time zone 'utc')::date;
  new.created_at := now();
  select id into new.round_id from public.vote_rounds where ended_at is null;
  if new.round_id is null then
    raise exception 'no_open_round';
  end if;
  perform pg_advisory_xact_lock(hashtext(new.voter::text));   -- two tabs at once can't sneak a 4th
  if (select count(*) from public.next_votes where voter = new.voter and day = new.day) >= 3 then
    raise exception 'daily_limit';
  end if;
  return new;
end;
$$;

create trigger before_next_vote_insert
  before insert on public.next_votes
  for each row execute function public.before_next_vote();

-- totals for the open round, for everyone, without showing who voted
create function public.next_vote_counts()
returns table (area_id text, votes bigint, today bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.area_id, count(*), count(*) filter (where v.day = (now() at time zone 'utc')::date)
  from public.next_votes v
  join public.vote_rounds r on r.id = v.round_id and r.ended_at is null
  group by v.area_id;
$$;

revoke all on function public.next_vote_counts() from public;
grant execute on function public.next_vote_counts() to anon, authenticated;

-- the admin closes the open round with its winner and opens the next one
create function public.end_vote_round(winner_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.vote_rounds set ended_at = now(), winner = winner_id where ended_at is null;
  insert into public.vote_rounds default values;
end;
$$;

revoke all on function public.end_vote_round(text) from public;
grant execute on function public.end_vote_round(text) to authenticated;

-- the first round
insert into public.vote_rounds default values;

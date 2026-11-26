-- Smoother Roads: the Vote page allows more than one vote for the same location.
-- Still 3 votes a day per visitor (the trigger from 027_work_votes.sql refuses the 4th); they can now all go to one
-- location. Each vote is its own row with its own id, so one of today's votes can be taken back at a time.
-- Paste into the Supabase SQL Editor and run once, after 027_work_votes.sql. Running it again is harmless.

alter table public.work_votes drop constraint if exists work_votes_pkey;
alter table public.work_votes add column if not exists id bigint generated always as identity;
alter table public.work_votes add primary key (id);

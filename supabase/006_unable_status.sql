-- Smoother Roads: add the "Can't cover" status.
-- Paste into the Supabase SQL Editor and run once, after 005_requests.sql.

alter table public.area_status
  drop constraint area_status_status_check,
  add constraint area_status_status_check check (status in ('requested', 'progress', 'released', 'unable'));

-- Smoother Roads: "Hill Climbs" as a category for requests (one road smoothed all the way up a mountain).
-- The request table only accepted the first seven categories; this adds 'hill'.
-- Paste into the Supabase SQL Editor and run once, after 005_requests.sql. Running it again is harmless.
-- Afterwards set hillRequests: true in src/lib/config.ts so the request form offers it.

alter table public.area_requests drop constraint if exists area_requests_cat_check;
alter table public.area_requests
  add constraint area_requests_cat_check
  check (cat in ('city', 'town', 'airport', 'mountain', 'coastal', 'race', 'island', 'hill'));

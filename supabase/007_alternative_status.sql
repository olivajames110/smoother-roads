-- Smoother Roads: add the "Unable, but better alternative available" status.
-- Paste into the Supabase SQL Editor and run once. It includes 006, so running 006 first is optional.

alter table public.area_status
  drop constraint area_status_status_check,
  add constraint area_status_status_check
    check (status in ('requested', 'progress', 'released', 'unable', 'alternative'));

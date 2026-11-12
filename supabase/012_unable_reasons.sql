-- Smoother Roads: one "Unable" status with a reason (alternative available, no photogrammetry,
-- tried but didn't work). Paste into the Supabase SQL Editor and run once.

alter table public.area_status
  add column reason text check (reason in ('alternative', 'no-photogrammetry', 'tried'));

-- the old "Better option available" status becomes Unable + Alternative available
update public.area_status set status = 'unable', reason = 'alternative' where status = 'alternative';
-- areas already marked unable: "Tried, didn't work"
update public.area_status set reason = 'tried' where status = 'unable' and reason is null;

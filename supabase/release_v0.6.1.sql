-- Smoother Roads v0.6.1 release: Tulsa Released. Derby (Denver) stays In progress: 0.6.1 has only
-- the very beginning of it (LoDo, ~18 km), and its smoothed streets show on the map from
-- public/lines. Paste into the Supabase SQL Editor and run once.

begin;

insert into public.area_status (area_id, status, updated_at)
values
  ('c268a0b7-8cd5-4cf4-9f6b-f15130af5490', 'released', now())  -- Tulsa
on conflict (area_id) do update set status = 'released', reason = null, updated_at = now();

commit;

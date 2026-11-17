-- Smoother Roads v0.6.0 release: mark the 7 new areas Released, and delete the hidden
-- "Orlando test" area for good (its comments, places/routes, photos, votes and status too).
-- Paste into the Supabase SQL Editor and run once. Stops without changing anything unless
-- exactly one area is named "Orlando test".

begin;

-- 1. Released (area_status overrides the status in areas.json)
insert into public.area_status (area_id, status, updated_at)
values
  ('orlando-fl', 'released', now()),
  ('green-bay-wi', 'released', now()),
  ('winslow-township-nj', 'released', now()),
  ('frederiksberg-denmark', 'released', now()),
  ('61470169-e1ef-4d10-bcae-3cf9d5678244', 'released', now()), -- Melbourne
  ('e8fbe9de-54c1-474a-8835-0cb7cbda0983', 'released', now()), -- Perth
  ('eebb1cb9-9114-429b-a09b-04eeddb368d3', 'released', now())  -- Milan
on conflict (area_id) do update set status = 'released', reason = null, updated_at = now();

-- 2. Delete "Orlando test"
do $$
declare
  n int;
  tid text;
begin
  select count(*), min(id::text) into n, tid
  from public.area_requests where lower(btrim(name)) = 'orlando test';
  if n <> 1 then
    raise exception 'Expected exactly one area named "Orlando test", found %', n;
  end if;
  delete from public.area_comments where area_id = tid;
  delete from public.area_pois where area_id = tid;
  delete from public.area_photos where area_id = tid;
  delete from public.area_votes where area_id = tid;
  delete from public.area_status where area_id = tid;
  delete from public.area_requests where id::text = tid;
  raise notice 'Deleted Orlando test (%)', tid;
end $$;

commit;

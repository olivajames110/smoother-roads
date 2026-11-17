-- Smoother Roads: an improvement request can mark a route (the roads to smooth, in order) instead of
-- one spot. Paste into the Supabase SQL Editor and run once, after 022_site_visits.sql.
--
-- path: [[lat, lon], ...], 2 to 50 points, start to finish. Only on 'improve' comments. The comment's
-- pin is set to the route's start, so anything that only knows pins still shows where it is.

alter table public.area_comments
  add column path jsonb;

alter table public.area_comments
  add constraint area_comments_path_check check (
    path is null or (
      type = 'improve'
      and jsonb_typeof(path) = 'array'
      and jsonb_array_length(path) between 2 and 50
      and char_length(path::text) <= 4000
    )
  );

grant select (path) on public.area_comments to anon, authenticated;
grant insert (path) on public.area_comments to authenticated;

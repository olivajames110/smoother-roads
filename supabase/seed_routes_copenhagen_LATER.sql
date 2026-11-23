-- NOT FOR 0.6.2. Two Copenhagen routes, to run when Copenhagen v2 is released (0.6.3 or later):
-- they were checked against the v2 build's smoothed roads, not the released pack.
-- Needs 024_route_twilight.sql. Paste into the Supabase SQL Editor and run once.

begin;
alter table public.area_pois disable trigger before_poi_insert;

insert into public.area_pois (area_id, kind, name, lat, lon, end_lat, end_lon, via, time_of_day, author, approved, position)
select 'frederiksberg-denmark', 'route', 'Old Town to the Little Mermaid', 55.675928, 12.567957, 55.692928, 12.598743, '[[55.676175, 12.580266], [55.679748, 12.591395], [55.683901, 12.59271]]'::jsonb,
       'golden', 'Smoother Roads', true,
       coalesce((select max(position) + 1 from public.area_pois where area_id = 'frederiksberg-denmark'), 0)
where not exists (
  select 1 from public.area_pois where area_id = 'frederiksberg-denmark' and name = 'Old Town to the Little Mermaid'
);

insert into public.area_pois (area_id, kind, name, lat, lon, end_lat, end_lon, via, time_of_day, author, approved, position)
select 'frederiksberg-denmark', 'route', 'Tivoli to Christianshavn', 55.674608, 12.567297, 55.679864, 12.585377, '[[55.672798, 12.593765], [55.685288, 12.576531]]'::jsonb,
       'twilight', 'Smoother Roads', true,
       coalesce((select max(position) + 1 from public.area_pois where area_id = 'frederiksberg-denmark'), 0)
where not exists (
  select 1 from public.area_pois where area_id = 'frederiksberg-denmark' and name = 'Tivoli to Christianshavn'
);

alter table public.area_pois enable trigger before_poi_insert;
commit;

-- Smoother Roads v0.6.2: two Street GPS routes for the new lower Courchevel areas.
-- RUN 024_route_twilight.sql FIRST (one route uses 'twilight').
-- Paste into the Supabase SQL Editor and run once; running it again skips routes that already exist (same name).
-- The site shows them at once (no deploy). Then: python StreetGPS/build_places.py

begin;
alter table public.area_pois disable trigger before_poi_insert;

insert into public.area_pois (area_id, kind, name, lat, lon, end_lat, end_lon, via, time_of_day, author, approved, position)
select 'courchevel-france', 'route', 'To Lower Courchevel', 45.40123, 6.63815, 45.420094, 6.652059, '[]'::jsonb,
       'twilight', 'Smoother Roads', true,
       coalesce((select max(position) + 1 from public.area_pois where area_id = 'courchevel-france'), 0)
where not exists (
  select 1 from public.area_pois where area_id = 'courchevel-france' and name = 'To Lower Courchevel'
);

insert into public.area_pois (area_id, kind, name, lat, lon, end_lat, end_lon, via, time_of_day, author, approved, position)
select 'courchevel-france', 'route', 'Altiport to Courchevel 1550', 45.395929, 6.634366, 45.423973, 6.643227, '[[45.413995, 6.639159], [45.406024, 6.643453], [45.408517, 6.647252]]'::jsonb,
       'sunset', 'Smoother Roads', true,
       coalesce((select max(position) + 1 from public.area_pois where area_id = 'courchevel-france'), 0)
where not exists (
  select 1 from public.area_pois where area_id = 'courchevel-france' and name = 'Altiport to Courchevel 1550'
);

alter table public.area_pois enable trigger before_poi_insert;
commit;

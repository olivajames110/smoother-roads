-- Smoother Roads: Courchevel route, Altiport de Courchevel -> Courchevel 1850, best at noon.
-- Paste into the Supabase SQL Editor and run once; running it again skips it (same name).

begin;
alter table public.area_pois disable trigger before_poi_insert;

insert into public.area_pois (area_id, kind, name, lat, lon, end_lat, end_lon, via, time_of_day, author, approved, position)
select 'courchevel-france', 'route', 'Altiport to Courchevel 1850', 45.39597, 6.63440, 45.4141, 6.6350, '[]'::jsonb,
       'noon', 'Smoother Roads', true,
       coalesce((select max(position) + 1 from public.area_pois where area_id = 'courchevel-france'), 0)
where not exists (
  select 1 from public.area_pois where area_id = 'courchevel-france' and name = 'Altiport to Courchevel 1850'
);

alter table public.area_pois enable trigger before_poi_insert;
commit;

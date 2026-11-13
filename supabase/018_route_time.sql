-- Smoother Roads: a best time of day on routes (Street GPS sets the sim clock to it on Start).
-- Paste into the Supabase SQL Editor and run once, after 017_route_stops.sql.
-- Empty: any time (the clock isn't changed).

alter table public.area_pois
  add column time_of_day text
  check (time_of_day in ('sunrise', 'noon', 'golden', 'sunset', 'night'));

update public.area_pois set time_of_day = 'sunset'
  where area_id = 'san-diego-ca' and kind = 'route' and name = 'Sunset Cruise';

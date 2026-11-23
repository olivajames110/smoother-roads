-- Smoother Roads: "twilight" as a route's best time of day (just after sunset: sun 4 degrees below the
-- horizon, sky still lit). Street GPS sets the sim clock to it on Start.
-- Paste into the Supabase SQL Editor and run once, after 018_route_time.sql. Running it again is harmless.

alter table public.area_pois drop constraint if exists area_pois_time_of_day_check;
alter table public.area_pois
  add constraint area_pois_time_of_day_check
  check (time_of_day in ('sunrise', 'noon', 'golden', 'sunset', 'twilight', 'night'));

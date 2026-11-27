-- 031: Mount Fuji on the leaderboards, kept simple (Jim 2026-11-27, Street GPS v86): ONE Mount Fuji climb = the Subaru
-- Line from the toll gate to the 5th Station. Its course changed (the hook at the top is gone, 24.11 km), so the
-- earlier times are removed. The three extra Fuji boards of the first version of this file are removed if they exist.
-- Safe to run whether or not that first version was run. min_ms = the length at an average of 60 m/s, as in 028.
delete from public.climbs where id in ('mount-fuji-upper-summit-japan', 'mount-fuji-base-to-upper-japan', 'mount-fuji-northeast-japan');
delete from public.climb_times where climb = 'mount-fuji-japan';
insert into public.climbs (id, name, length_m, min_ms) values
  ('mount-fuji-japan', 'Mount Fuji', 24110, 402000)
on conflict (id) do update set name = excluded.name, length_m = excluded.length_m, min_ms = excluded.min_ms;

-- Smoother Roads: places in San Diego, CA (OpenStreetMap landmarks, each on the nearest road).
-- Made by StreetGPS/build_places.py --seed. Paste into the Supabase SQL Editor and run once.

begin;
alter table public.area_pois disable trigger before_poi_insert;

insert into public.area_pois (area_id, kind, name, category, lat, lon, approved, position) values
  ('san-diego-ca', 'place', 'Petco Park', 'Stadium', 32.706463, -117.156043, true, 0),
  ('san-diego-ca', 'place', 'Botanical Building', 'Attraction', 32.732721, -117.149237, true, 1),
  ('san-diego-ca', 'place', 'San Diego Convention Center', 'Attraction', 32.706062, -117.162305, true, 2),
  ('san-diego-ca', 'place', 'SDHS Balboa Stadium', 'Stadium', 32.720724, -117.149595, true, 3),
  ('san-diego-ca', 'place', 'San Diego Zoo', 'Zoo', 32.735863, -117.150692, true, 4),
  ('san-diego-ca', 'place', 'Pechanga Arena', 'Stadium', 32.754805, -117.212704, true, 5),
  ('san-diego-ca', 'place', 'Spanish Village Art Center', 'Attraction', 32.733675, -117.147875, true, 6),
  ('san-diego-ca', 'place', 'Star of India', 'Attraction', 32.720273, -117.173299, true, 7),
  ('san-diego-ca', 'place', 'USS Midway Museum', 'Museum', 32.714273, -117.175222, true, 8),
  ('san-diego-ca', 'place', 'Coronado Shores Beach', 'Beach', 32.676627, -117.174462, true, 9),
  ('san-diego-ca', 'place', 'Central Beach', 'Beach', 32.684183, -117.187001, true, 10),
  ('san-diego-ca', 'place', 'North Beach', 'Beach', 32.686265, -117.192493, true, 11),
  ('san-diego-ca', 'place', 'Museum of Contemporary Art', 'Museum', 32.717254, -117.16924, true, 12),
  ('san-diego-ca', 'place', 'Point Loma Light', 'Lighthouse', 32.665791, -117.242549, true, 13),
  ('san-diego-ca', 'place', 'Mingei International Museum', 'Museum', 32.730698, -117.15111, true, 14);

alter table public.area_pois enable trigger before_poi_insert;
commit;

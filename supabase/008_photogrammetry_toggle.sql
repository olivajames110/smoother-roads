-- Smoother Roads: set "Not a photogrammetry zone" from the admin menu.
-- Paste into the Supabase SQL Editor and run once. Empty keeps the value from areas.json.

alter table public.area_status
  add column no_photogrammetry boolean;

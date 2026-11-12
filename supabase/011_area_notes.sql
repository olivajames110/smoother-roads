-- Smoother Roads: edit an area's notes from the admin panel.
-- Paste into the Supabase SQL Editor and run once. Empty keeps the notes the area came with.

alter table public.area_status
  add column notes text;

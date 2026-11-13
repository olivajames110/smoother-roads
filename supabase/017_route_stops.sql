-- Smoother Roads: routes with stops between the start and the finish.
-- Paste into the Supabase SQL Editor and run once, after 016_suggest_pois.sql.
-- via holds the stops in driving order as [[lat, lon], ...]; places keep it empty.

alter table public.area_pois
  add column via jsonb not null default '[]'::jsonb
  check (jsonb_typeof(via) = 'array' and jsonb_array_length(via) <= 48);

-- Smoother Roads v0.6.2 release: Courchevel v2 (altiport to Courchevel 1850, about 18 km).
-- Courchevel is already Released, so its status does not change. The pack no longer reaches
-- Méribel, so the "Altiport de Méribel" place is hidden from the Courchevel area.
-- Paste into the Supabase SQL Editor and run once (running it again changes nothing).

begin;

update public.area_pois
set approved = false
where area_id = 'courchevel-france' and name = 'Altiport de Méribel';

commit;

-- Smoother Roads: visitors suggest places and routes; they wait until the admin approves them.
-- Paste into the Supabase SQL Editor and run once, after 015_area_pois.sql.

create policy "visitors suggest pois" on public.area_pois
  for insert to authenticated with check (true); -- the trigger below sets who and whether approved

-- Sets the fields a visitor must not choose, and limits how fast one browser can suggest
create function public.before_poi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin boolean := public.is_admin();
begin
  if tg_op = 'UPDATE' then
    return new; -- only the admin can update (policy), so whatever they set stands
  end if;
  new.author_id := auth.uid();
  new.approved := admin;               -- the admin's own go straight up; visitors' wait
  new.created_at := now();
  if not admin then
    new.position := 1000;              -- after the ones already in order
  end if;
  if new.author_id is null then
    raise exception 'sign-in required';
  end if;
  if not admin and (
    (select count(*) from public.area_pois
      where author_id = new.author_id and created_at > now() - interval '10 minutes') >= 5
    or (select count(*) from public.area_pois
      where author_id = new.author_id and created_at > now() - interval '1 day') >= 20
  ) then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;

create trigger before_poi_insert
  before insert on public.area_pois
  for each row execute function public.before_poi();

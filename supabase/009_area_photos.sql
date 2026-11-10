-- Smoother Roads: photos on areas. Visitors upload, the admin approves, reorders and deletes.
-- Paste into the Supabase SQL Editor and run once, after 008_photogrammetry_toggle.sql.

-- Public bucket so approved photos load by address. Names are random and listing isn't allowed,
-- so a photo waiting for approval can't be found. The site shrinks photos before upload; 2 MB is a backstop.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('area-photos', 'area-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Uploads per visitor: 10 in 10 minutes and 30 a day. The admin has no limit.
create function public.photo_quota_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or (
    (select count(*) from storage.objects
      where bucket_id = 'area-photos' and owner_id = auth.uid()::text
        and created_at > now() - interval '10 minutes') < 10
    and (select count(*) from storage.objects
      where bucket_id = 'area-photos' and owner_id = auth.uid()::text
        and created_at > now() - interval '1 day') < 30
  );
$$;

create policy "visitors upload area photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'area-photos'
    and name ~ '^[a-z0-9-]{1,80}/[0-9a-f-]{36}\.jpg$'
    and public.photo_quota_ok()
  );

-- Removing a file reads it first, so the admin needs both
create policy "admin reads area photos" on storage.objects
  for select to authenticated using (bucket_id = 'area-photos' and public.is_admin());

create policy "admin deletes area photos" on storage.objects
  for delete to authenticated using (bucket_id = 'area-photos' and public.is_admin());

create table public.area_photos (
  id         uuid primary key default gen_random_uuid(),
  area_id    text not null check (area_id ~ '^[a-z0-9-]{1,80}$'),
  path       text not null unique,
  author_id  uuid references auth.users (id) on delete set null,
  author     text not null check (char_length(btrim(author)) between 1 and 40),
  dev        boolean not null default false,
  width      integer not null check (width between 1 and 10000),
  height     integer not null check (height between 1 and 10000),
  position   integer not null default 0,
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);
create index area_photos_area on public.area_photos (area_id, position);
create index area_photos_author on public.area_photos (author_id, created_at);

alter table public.area_photos enable row level security;

-- Who uploaded stays private: author_id isn't readable
revoke all on public.area_photos from anon, authenticated;
grant select (id, area_id, path, author, dev, width, height, position, approved, created_at)
  on public.area_photos to anon, authenticated;
grant insert (area_id, path, author, width, height) on public.area_photos to authenticated;
grant update (approved) on public.area_photos to authenticated;
grant delete on public.area_photos to authenticated;

-- Visitors only see approved photos; the admin also sees the ones waiting
create policy "read approved photos" on public.area_photos
  for select to anon, authenticated using (approved or public.is_admin());

create policy "add photos" on public.area_photos
  for insert to authenticated with check (true); -- The trigger below checks and fills in the rest

create policy "admin approves photos" on public.area_photos
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin deletes photos" on public.area_photos
  for delete to authenticated using (public.is_admin());

-- Sets the fields a visitor must not choose. The file must be the visitor's own upload for this area.
create function public.before_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin boolean := public.is_admin();
begin
  new.author_id := auth.uid();
  new.dev := admin;
  new.approved := admin; -- The admin's own photos skip approval
  new.created_at := now();
  if new.author_id is null then
    raise exception 'sign-in required';
  end if;
  if split_part(new.path, '/', 1) <> new.area_id or not exists (
    select 1 from storage.objects
    where bucket_id = 'area-photos' and name = new.path and owner_id = auth.uid()::text
  ) then
    raise exception 'photo not uploaded';
  end if;
  if not admin and (select count(*) from public.area_photos
      where author_id = new.author_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'rate_limited';
  end if;
  -- New photos go to the end
  new.position := coalesce((select max(position) + 1 from public.area_photos where area_id = new.area_id), 0);
  return new;
end;
$$;

create trigger before_photo_insert
  before insert on public.area_photos
  for each row execute function public.before_photo();

-- The admin's drag-and-drop order: ids from first to last
create function public.reorder_area_photos(area text, ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.area_photos p
    set position = o.i - 1
    from unnest(ids) with ordinality as o (id, i)
    where p.id = o.id and p.area_id = area;
end;
$$;

revoke execute on function public.reorder_area_photos(text, uuid[]) from public, anon;
grant execute on function public.reorder_area_photos(text, uuid[]) to authenticated;

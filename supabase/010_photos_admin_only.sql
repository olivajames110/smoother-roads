-- Smoother Roads: only the admin adds area photos. Visitors can still view approved ones.
-- Paste into the Supabase SQL Editor and run once, after 009_area_photos.sql.

drop policy "visitors upload area photos" on storage.objects;
create policy "admin uploads area photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'area-photos'
    and name ~ '^[a-z0-9-]{1,80}/[0-9a-f-]{36}\.jpg$'
    and public.is_admin()
  );

drop policy "add photos" on public.area_photos;
create policy "admin adds photos" on public.area_photos
  for insert to authenticated with check (public.is_admin());

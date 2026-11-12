-- Smoother Roads: let the admin's "Delete for good" remove a request's votes too.
-- Paste into the Supabase SQL Editor and run once. Without it the votes are left behind, unseen.

create policy "admin deletes votes" on public.area_votes
  for delete to authenticated using (public.is_admin());

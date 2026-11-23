-- Smoother Roads: the admin can edit the text of any comment (the "Edit" link under a comment on ?admin).
-- Only the column grant is new: the "admin hides comments" policy from 002 already limits every update
-- on area_comments to the admin, so visitors still can't change anything.
-- Paste into the Supabase SQL Editor and run once, after 002_comments.sql. Running it again is harmless.

grant update (body) on public.area_comments to authenticated;

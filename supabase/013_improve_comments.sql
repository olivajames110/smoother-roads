-- Smoother Roads: "Improve" comments (a request for roads or a spot to be made smoother).
-- Paste into the Supabase SQL Editor and run once.

alter table public.area_comments
  drop constraint if exists area_comments_type_check,
  add constraint area_comments_type_check
    check (type in ('feedback', 'issue', 'improve', 'question'));

-- Smoother Roads: star ratings (reviews) on released areas, like flightsim.to.
-- Paste into the Supabase SQL Editor and run once, after 013_improve_comments.sql.
--
-- A review is a comment of type 'review' with 1 to 5 stars; the text is optional. Each visitor
-- (anonymous sign-in: one per browser) has at most one review per area, and can change it later.

alter table public.area_comments
  add column rating smallint check (rating between 1 and 5);

alter table public.area_comments
  drop constraint if exists area_comments_type_check,
  add constraint area_comments_type_check
    check (type in ('feedback', 'issue', 'improve', 'question', 'review'));

-- a review has stars (and only a review), and its text may be empty
alter table public.area_comments
  drop constraint if exists area_comments_body_check,
  add constraint area_comments_body_check
    check (char_length(body) <= 2000 and (type = 'review' or char_length(btrim(body)) >= 1)),
  add constraint area_comments_review_rating
    check ((type = 'review') = (rating is not null));

-- one review per visitor per area
create unique index area_comments_one_review on public.area_comments (area_id, author_id)
  where type = 'review';

grant select (rating) on public.area_comments to anon, authenticated;
grant insert (rating) on public.area_comments to authenticated;

-- reviews only on released areas (an area whose status the admin has set to something else is refused;
-- the site only offers reviews on released areas), and never as a reply
create function public.before_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'review' then
    if new.reply_to is not null then
      raise exception 'review_reply';
    end if;
    if exists (select 1 from public.area_status where area_id = new.area_id and status <> 'released') then
      raise exception 'not_released';
    end if;
  end if;
  return new;
end;
$$;

create trigger before_review_insert
  before insert on public.area_comments
  for each row execute function public.before_review();

-- the visitor's own reviews (ids only; who wrote what stays private)
create function public.my_reviews()
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.area_comments c where c.type = 'review' and c.author_id = auth.uid();
$$;

revoke all on function public.my_reviews() from public;
grant execute on function public.my_reviews() to authenticated;

-- change your own review: the stars, the text and the name shown
create function public.edit_review(review_id uuid, stars smallint, review text, name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sign-in required';
  end if;
  update public.area_comments
     set rating = stars, body = review, author = name, created_at = now()
   where id = review_id and type = 'review' and author_id = auth.uid();
  if not found then
    raise exception 'not_yours';
  end if;
end;
$$;

revoke all on function public.edit_review(uuid, smallint, text, text) from public;
grant execute on function public.edit_review(uuid, smallint, text, text) to authenticated;

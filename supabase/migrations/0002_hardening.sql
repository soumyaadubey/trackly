-- 0002 — security and performance hardening.
--
-- Apply this to any project that was set up with 0001. It is idempotent.
--
-- What it changes, and why:
--
--   1. Storage: the avatars bucket gained a size limit and a MIME allowlist.
--      Previously the only limits lived in the server action, which a user can
--      skip entirely by calling the Storage REST API with their own JWT. SVG is
--      excluded because the bucket is public and an SVG is executable content.
--   2. RLS: auth.uid() is wrapped in a subquery so it is evaluated once per
--      statement instead of once per row, and policies are scoped to the
--      authenticated role so they stop being evaluated for anon.
--   3. set_updated_at: search_path pinned (Supabase linter 0011).
--   4. Indexes replaced to match the queries the app actually issues.
--   5. Length constraints on every user-supplied field.
--   6. A generated search_text column so free-text search is one indexed
--      predicate covering title, notes AND tags.
--   7. delete_current_user(), so account deletion is self-serve without the
--      app ever holding a service_role key.
--
begin;

-- --- 0. Pre-flight ---------------------------------------------------------
--
-- The length constraints below cannot be added if existing rows already
-- violate them. Checking here rather than in a separate query means this file
-- is a single safe paste: if anything is too long it aborts with a message
-- naming the problem, and the transaction rolls back having changed nothing.

do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
    from public.items
   where char_length(title) > 300
      or char_length(url) > 2048
      or char_length(coalesce(notes, '')) > 10000
      or coalesce(array_length(tags, 1), 0) > 20;

  if bad_count > 0 then
    raise exception 'Pre-flight failed: % row(s) exceed the new length limits (title 300, url 2048, notes 10000, tags 20). Nothing was changed.', bad_count
      using hint = 'See supabase/migrations/0002_hardening.sql for the query that lists them.';
  end if;
end $$;

-- --- 1. Extensions --------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;

-- --- 2. Length constraints ------------------------------------------------

alter table public.items drop constraint if exists items_title_len_check;
alter table public.items add constraint items_title_len_check
  check (char_length(title) between 1 and 300);

alter table public.items drop constraint if exists items_url_len_check;
alter table public.items add constraint items_url_len_check
  check (char_length(url) between 1 and 2048);

alter table public.items drop constraint if exists items_notes_len_check;
alter table public.items add constraint items_notes_len_check
  check (notes is null or char_length(notes) <= 10000);

-- A CHECK constraint cannot contain a subquery (Postgres 0A000), and there is
-- no subquery-free expression that tests every element of an array. An
-- IMMUTABLE helper does the unnest inside a function body, which a CHECK is
-- allowed to call.
--
-- Caveat: changing this function later does NOT re-validate existing rows.
-- After altering it, revalidate explicitly with
--   alter table public.items validate constraint items_tags_check;
create or replace function public.tags_are_valid(p_tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(p_tags, 1), 0) <= 20
     and not exists (
       select 1 from unnest(p_tags) as t
        where char_length(t) = 0 or char_length(t) > 50
     );
$$;

alter table public.items drop constraint if exists items_tags_check;
alter table public.items add constraint items_tags_check
  check (public.tags_are_valid(tags));

-- --- 3. Searchable generated column ---------------------------------------

-- A generated column's expression must be IMMUTABLE, and array_to_string is
-- marked STABLE: it is generic over anyarray, and for some element types the
-- output function depends on session settings (a timestamptz renders per
-- TimeZone). For text[] it is genuinely deterministic, so wrapping it in an
-- IMMUTABLE function is the accepted workaround rather than a fudge.
--
-- Caveat: if this function is ever changed, existing rows keep the values they
-- were generated with. Changing it requires rewriting the column
--   (alter table public.items drop column search_text, then re-add it).
create or replace function public.items_search_text(
  p_title text, p_notes text, p_tags text[]
)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_title || ' ' || coalesce(p_notes, '') || ' ' ||
         coalesce(array_to_string(p_tags, ' '), '');
$$;

alter table public.items
  add column if not exists search_text text
  generated always as (public.items_search_text(title, notes, tags)) stored;

-- --- 4. Indexes -----------------------------------------------------------

create index if not exists items_user_kind_deadline_idx
  on public.items (user_id, kind, deadline);

create index if not exists items_user_deadline_idx
  on public.items (user_id, deadline)
  where deadline is not null;

create index if not exists items_search_trgm_idx
  on public.items using gin (search_text extensions.gin_trgm_ops);

create index if not exists items_tags_idx
  on public.items using gin (tags);

drop index if exists public.items_kind_idx;
drop index if exists public.items_deadline_idx;
drop index if exists public.items_user_id_idx;

-- --- 5. RLS policies ------------------------------------------------------

drop policy if exists "Users can view their own items" on public.items;
create policy "Users can view their own items"
  on public.items for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own items" on public.items;
create policy "Users can insert their own items"
  on public.items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own items" on public.items;
create policy "Users can update their own items"
  on public.items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own items" on public.items;
create policy "Users can delete their own items"
  on public.items for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- --- 6. Trigger function search_path ---------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row
  execute function public.set_updated_at();

-- --- 7. Self-serve account deletion ---------------------------------------

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from storage.objects
    where bucket_id = 'avatars'
      and (storage.foldername(name))[1] = uid::text;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;

-- --- 8. Avatars bucket limits ---------------------------------------------

update storage.buckets
   set public = true,
       file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
 where id = 'avatars';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text || '/avatar\.(jpg|jpeg|png|gif|webp)$')
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text || '/avatar\.(jpg|jpeg|png|gif|webp)$')
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;

-- Existing avatars uploaded before this migration may sit at a path or MIME
-- type the new policies reject. They stay readable; the next upload replaces
-- them at a conforming path. To audit what is currently stored:
--   select name, metadata->>'mimetype' as mime, metadata->>'size' as bytes
--     from storage.objects where bucket_id = 'avatars';

-- If the pre-flight above aborted, this lists the offending rows:
--
--   select id, title,
--          char_length(title)              as title_len,
--          char_length(url)                as url_len,
--          char_length(coalesce(notes,'')) as notes_len,
--          coalesce(array_length(tags,1),0) as tag_count
--     from public.items
--    where char_length(title) > 300
--       or char_length(url) > 2048
--       or char_length(coalesce(notes,'')) > 10000
--       or coalesce(array_length(tags,1),0) > 20;

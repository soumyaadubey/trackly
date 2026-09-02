-- Trackly — full current-state schema.
--
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- for a FRESH project. It is idempotent, so re-running it is safe.
--
-- For an EXISTING project that was set up with an earlier version of this file,
-- do not re-run this — apply the numbered files in supabase/migrations/ instead,
-- in order. This file is the destination those migrations arrive at.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- Trigram matching, so the free-text search can use an index instead of a
-- sequential scan. A leading-wildcard ILIKE ('%term%') can never use a btree.
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'opportunity'
    check (kind in ('opportunity', 'course', 'roadmap')),
  title text not null,
  url text not null,
  status text not null default 'saved',
  tags text[] not null default '{}',
  deadline date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_status_check check (
    (kind = 'opportunity' and status in
      ('saved', 'applying', 'applied', 'interview', 'accepted', 'rejected', 'ghosted'))
    or (kind = 'course' and status in
      ('saved', 'in_progress', 'completed', 'abandoned'))
    or (kind = 'roadmap' and status in
      ('saved', 'in_progress', 'completed'))
  )
);

-- Bound every user-supplied field. Without these a single request can write an
-- unbounded amount of text, and the row size is the only thing standing between
-- a free-tier database and someone filling it.
alter table public.items drop constraint if exists items_title_len_check;
alter table public.items add constraint items_title_len_check
  check (char_length(title) between 1 and 300);

alter table public.items drop constraint if exists items_url_len_check;
alter table public.items add constraint items_url_len_check
  check (char_length(url) between 1 and 2048);

alter table public.items drop constraint if exists items_notes_len_check;
alter table public.items add constraint items_notes_len_check
  check (notes is null or char_length(notes) <= 10000);

-- A CHECK constraint cannot contain a subquery, so the per-element test lives
-- in an IMMUTABLE helper, which a CHECK is allowed to call.
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

-- One column the free-text search can point at, so "search titles, tags, notes"
-- is a single indexed predicate rather than three ORed sequential scans.
alter table public.items
  add column if not exists search_text text
  generated always as (
    title || ' ' || coalesce(notes, '') || ' ' || array_to_string(tags, ' ')
  ) stored;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- The hot list query filters user_id (via RLS) + kind + status and orders by
-- deadline. A composite index covering that shape lets Postgres satisfy the
-- filter and the sort from one scan.
create index if not exists items_user_kind_deadline_idx
  on public.items (user_id, kind, deadline);

-- Dashboard "Coming up": user's items that have a deadline, soonest first.
create index if not exists items_user_deadline_idx
  on public.items (user_id, deadline)
  where deadline is not null;

create index if not exists items_search_trgm_idx
  on public.items using gin (search_text extensions.gin_trgm_ops);

create index if not exists items_tags_idx
  on public.items using gin (tags);

-- Superseded by the composite indexes above. A plain index on a three-value
-- column is never selective enough for the planner to choose it.
drop index if exists public.items_kind_idx;
drop index if exists public.items_deadline_idx;
drop index if exists public.items_user_id_idx;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.items enable row level security;

-- auth.uid() is wrapped in a subquery so Postgres hoists it into an InitPlan and
-- evaluates it once per statement rather than once per candidate row.
-- Each policy is scoped `to authenticated` so it is not also evaluated for anon.

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

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

-- search_path is pinned to empty so the function body cannot be hijacked by a
-- schema earlier on a caller's search_path (Supabase linter: 0011).
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

-- ---------------------------------------------------------------------------
-- Self-serve account deletion
-- ---------------------------------------------------------------------------

-- Lets a signed-in user delete their own auth record, which cascades to items.
-- Doing this as a security-definer function scoped to auth.uid() means the app
-- never needs the service_role key, which would otherwise have to be deployed
-- as an environment variable and would grant far more than account deletion.
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

  -- items rows go with this via the on delete cascade on user_id.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Avatars storage bucket
-- ---------------------------------------------------------------------------

-- Public read, per-user write. The size and MIME limits live on the bucket
-- because the Storage API enforces those itself: a user holding their own JWT
-- can call the Storage REST API directly and skip the app's server action
-- entirely, so any validation that exists only in application code is advisory.
--
-- SVG is deliberately excluded. The bucket is public, and an SVG is an
-- executable document — serving an attacker-supplied one from the storage
-- origin is stored XSS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB, matches MAX_AVATAR_BYTES in src/lib/avatar.ts
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- The path is constrained to exactly "<uid>/avatar.<ext>" so a user cannot fill
-- the bucket with arbitrarily many arbitrarily named objects inside their folder.
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

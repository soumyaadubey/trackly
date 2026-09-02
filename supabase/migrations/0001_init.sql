-- 0001 — initial schema.
--
-- This records the schema as it was originally applied by hand through the
-- Supabase SQL editor, so the migration history starts from a truthful
-- baseline. If your project already has these objects, this file is a no-op
-- description of what you already have — start from 0002.

create table if not exists items (
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

create index if not exists items_user_id_idx on items (user_id);
create index if not exists items_deadline_idx on items (deadline);
create index if not exists items_kind_idx on items (kind);

alter table items enable row level security;

create policy "Users can view their own items"
  on items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own items"
  on items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own items"
  on items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own items"
  on items for delete
  using (auth.uid() = user_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger items_set_updated_at
  before update on items
  for each row
  execute function set_updated_at();

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

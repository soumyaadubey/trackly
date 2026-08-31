-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)
-- for your project, once, after creating it.

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  url text not null,
  status text not null default 'saved'
    check (status in ('saved', 'applying', 'applied', 'interview', 'accepted', 'rejected', 'ghosted')),
  tags text[] not null default '{}',
  deadline date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_user_id_idx on opportunities (user_id);
create index if not exists opportunities_deadline_idx on opportunities (deadline);

alter table opportunities enable row level security;

create policy "Users can view their own opportunities"
  on opportunities for select
  using (auth.uid() = user_id);

create policy "Users can insert their own opportunities"
  on opportunities for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own opportunities"
  on opportunities for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own opportunities"
  on opportunities for delete
  using (auth.uid() = user_id);

-- Keep updated_at current on every row change.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger opportunities_set_updated_at
  before update on opportunities
  for each row
  execute function set_updated_at();

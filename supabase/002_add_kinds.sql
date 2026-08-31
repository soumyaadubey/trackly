-- Run this in the Supabase SQL editor AFTER schema.sql has already been run.
-- Adds course/roadmap support alongside opportunities, renaming the table
-- from `opportunities` to `items` and adding a `kind` column.

alter table opportunities rename to items;

alter table items
  add column kind text not null default 'opportunity'
    check (kind in ('opportunity', 'course', 'roadmap'));

-- Replace the old opportunity-only status check with one that allows the
-- full set of statuses used across all three kinds, constrained per-kind.
alter table items drop constraint if exists opportunities_status_check;
alter table items drop constraint if exists items_status_check;

alter table items add constraint items_status_check check (
  (kind = 'opportunity' and status in
    ('saved', 'applying', 'applied', 'interview', 'accepted', 'rejected', 'ghosted'))
  or (kind = 'course' and status in
    ('saved', 'in_progress', 'completed', 'abandoned'))
  or (kind = 'roadmap' and status in
    ('saved', 'in_progress', 'completed'))
);

create index if not exists items_kind_idx on items (kind);

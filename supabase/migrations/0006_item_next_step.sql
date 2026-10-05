-- An opportunity's application deadline stops mattering once it is applied
-- to, but what comes next (an interview, a result date) still has a date.
-- One optional next step per item: a type and a date, always together.
begin;
alter table public.items add column if not exists next_step text;
alter table public.items add column if not exists next_step_date date;
alter table public.items drop constraint if exists items_next_step_check;
alter table public.items add constraint items_next_step_check check (
  (next_step is null) = (next_step_date is null)
  and (next_step is null or next_step in ('interview', 'follow_up', 'result', 'other'))
);
commit;

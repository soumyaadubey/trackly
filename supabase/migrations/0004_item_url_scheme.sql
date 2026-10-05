-- Only http(s) links may be stored. The app already enforces this, but a row
-- written straight through the API never passes the app, and the list renders
-- the link as an href. Checking the scheme here closes that path.
--
-- Added NOT VALID so an existing non-http row cannot fail the migration, then
-- validated in the same transaction when no such row exists. If one does, the
-- constraint still applies to every insert and update; find the rows with
--   select id, url from public.items where url !~* '^https?://';
-- fix them, and run: alter table public.items validate constraint items_url_scheme_check;
begin;
alter table public.items drop constraint if exists items_url_scheme_check;
alter table public.items add constraint items_url_scheme_check
  check (url ~* '^https?://') not valid;
do $$
begin
  if not exists (select 1 from public.items where url !~* '^https?://') then
    alter table public.items validate constraint items_url_scheme_check;
  else
    raise notice 'items_url_scheme_check left NOT VALID: existing rows have non-http links';
  end if;
end $$;
commit;

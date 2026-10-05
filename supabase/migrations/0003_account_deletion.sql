-- Remove the session-only deletion bypass. Deploy the server deletion handler
-- and configure SUPABASE_SECRET_KEY alongside this migration. Storage cleanup
-- now uses the Storage API; do not enable storage.allow_delete_query.
begin;
drop function if exists public.delete_current_user();
commit;

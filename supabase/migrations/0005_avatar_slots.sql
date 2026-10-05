-- Avatar replacement uploads into whichever of two slots the profile is not
-- using (avatar-a / avatar-b), updates the profile, and only then removes the
-- old file, so a failed replacement never leaves the user without a photo.
-- The policies accepted only "<uid>/avatar.<ext>"; allow the two slots too.
-- Still a fixed, small set of names, so a user cannot fill the bucket.
begin;
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text || '/avatar(-[ab])?\.(jpg|jpeg|png|gif|webp)$')
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
    and name ~ ('^' || (select auth.uid())::text || '/avatar(-[ab])?\.(jpg|jpeg|png|gif|webp)$')
  );
commit;

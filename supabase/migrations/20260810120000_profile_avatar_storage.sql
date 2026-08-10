-- Phase A preparation only. Apply remotely only after reviewing the current Storage state.
-- One public, immutable-path avatar per authenticated user. The object policy limits all writes
-- to the actor's own <auth.uid()>/avatar path; public reads are served by the bucket itself.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'weaf_avatar_insert_own') then
    create policy weaf_avatar_insert_own on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and name = (select auth.uid()::text) || '/avatar');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'weaf_avatar_update_own') then
    create policy weaf_avatar_update_own on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and name = (select auth.uid()::text) || '/avatar')
      with check (bucket_id = 'avatars' and name = (select auth.uid()::text) || '/avatar');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'weaf_avatar_delete_own') then
    create policy weaf_avatar_delete_own on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and name = (select auth.uid()::text) || '/avatar');
  end if;
end $$;

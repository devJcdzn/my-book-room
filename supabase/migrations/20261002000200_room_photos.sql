insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-photos', 'room-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users read their own room photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'room-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload their own room photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'room-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own room photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'room-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

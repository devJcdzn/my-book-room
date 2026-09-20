begin;

select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'one@example.com', ''),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'two@example.com', '');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$ select * from public.save_user_library_backup('{"books":[]}'::jsonb, null) $$,
  'user creates own backup'
);

select is((select revision from public.user_library_backups), 1::bigint, 'first revision is one');

select lives_ok(
  $$ select * from public.save_user_library_backup('{"books":[{"id":"one"}]}'::jsonb, 1) $$,
  'matching revision updates backup'
);

select is(
  (select count(*)::integer from public.user_library_backups where user_id = '00000000-0000-0000-0000-000000000102'),
  0,
  'user cannot see another backup'
);

select * from finish();
rollback;

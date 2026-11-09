begin;
insert into auth.users(id) values ('e8bc7543-9b31-4939-a7aa-d4d3efa5283e');
select set_config('request.jwt.claim.sub', 'e8bc7543-9b31-4939-a7aa-d4d3efa5283e', true);
set local role authenticated;

do $$
declare
  saved record;
begin
  select * into saved from public.save_user_library_backup('{"books":[]}', null);
  if saved.revision <> 1 then raise exception 'legacy insert failed'; end if;
  select * into saved from public.save_user_library_backup('{"readingHistoryVersion":1,"readingSessions":[{"id":"preserved"}]}', 1);
  if saved.revision <> 2 then raise exception 'upgrade failed'; end if;

  begin
    perform public.save_user_library_backup('{"books":[]}', 2);
    raise exception 'old client was allowed';
  exception when sqlstate 'PT426' then null;
  end;
  begin
    perform public.save_user_library_backup('{"readingHistoryVersion":0}', 2);
    raise exception 'downgrade was allowed';
  exception when sqlstate 'PT426' then null;
  end;
  begin
    perform public.save_user_library_backup('{"readingHistoryVersion":1}', 1);
    raise exception 'stale revision was allowed';
  exception when sqlstate 'PT409' then null;
  end;
  select * into saved from public.user_library_backups where user_id = auth.uid();
  if saved.revision <> 2 or saved.snapshot->'readingSessions'->0->>'id' <> 'preserved' then
    raise exception 'rejected write changed the backup';
  end if;
  select * into saved from public.save_user_library_backup('{"readingHistoryVersion":1,"readingSessions":[{"id":"updated"}]}', 2);
  if saved.revision <> 3 then raise exception 'compatible client could not write'; end if;
end;
$$;
rollback;

-- A stale backup revision is an expected HTTP conflict, not a server failure.
create or replace function public.save_user_library_backup(
  p_snapshot jsonb,
  p_expected_revision bigint default null
)
returns table(snapshot jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'autenticação necessária';
  end if;

  if jsonb_typeof(p_snapshot) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'snapshot inválido';
  end if;

  if p_expected_revision is null then
    insert into public.user_library_backups (user_id, snapshot)
    values (current_user_id, p_snapshot)
    on conflict (user_id) do nothing;

    if not found then
      raise exception using errcode = 'PT409', message = 'backup atualizado em outro aparelho';
    end if;
  else
    update public.user_library_backups as backup
       set snapshot = p_snapshot,
           revision = backup.revision + 1,
           updated_at = now()
     where backup.user_id = current_user_id
       and backup.revision = p_expected_revision;

    if not found then
      raise exception using errcode = 'PT409', message = 'backup atualizado em outro aparelho';
    end if;
  end if;

  return query
    select backup.snapshot, backup.revision, backup.updated_at
      from public.user_library_backups as backup
     where backup.user_id = current_user_id;
end;
$$;

revoke all on function public.save_user_library_backup(jsonb, bigint) from public, anon;
grant execute on function public.save_user_library_backup(jsonb, bigint) to authenticated;

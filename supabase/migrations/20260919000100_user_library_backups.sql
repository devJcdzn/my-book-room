create table if not exists public.user_library_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint user_library_backups_snapshot_object_check
    check (jsonb_typeof(snapshot) = 'object')
);

alter table public.user_library_backups enable row level security;

revoke all on table public.user_library_backups from public, anon;
grant select, insert, update, delete on table public.user_library_backups to authenticated;

create policy "Users read their own library backup"
  on public.user_library_backups for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert their own library backup"
  on public.user_library_backups for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update their own library backup"
  on public.user_library_backups for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete their own library backup"
  on public.user_library_backups for delete to authenticated
  using ((select auth.uid()) = user_id);

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
      raise exception using errcode = '40001', message = 'backup atualizado em outro aparelho';
    end if;
  else
    update public.user_library_backups as backup
       set snapshot = p_snapshot,
           revision = backup.revision + 1,
           updated_at = now()
     where backup.user_id = current_user_id
       and backup.revision = p_expected_revision;

    if not found then
      raise exception using errcode = '40001', message = 'backup atualizado em outro aparelho';
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

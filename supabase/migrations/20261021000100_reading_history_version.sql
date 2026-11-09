-- Runs in the same transaction as save_user_library_backup, preserving its revision check.
-- Also protects direct updates allowed by the existing RLS policies.
create or replace function public.protect_reading_history_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  previous_version numeric := case when jsonb_typeof(old.snapshot->'readingHistoryVersion') = 'number'
    then (old.snapshot->>'readingHistoryVersion')::numeric else 0 end;
  incoming_version numeric := case when jsonb_typeof(new.snapshot->'readingHistoryVersion') = 'number'
    then (new.snapshot->>'readingHistoryVersion')::numeric else 0 end;
begin
  if previous_version >= 1 and incoming_version < previous_version then
    raise exception using errcode = 'PT426', message = 'Atualize o Nookly para sincronizar este histórico de leitura.';
  end if;
  return new;
end;
$$;

create trigger protect_reading_history_version
before update of snapshot on public.user_library_backups
for each row execute function public.protect_reading_history_version();

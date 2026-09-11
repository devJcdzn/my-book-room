create table if not exists public.testflight_waitlist (
  id bigint generated always as identity primary key,
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  created_at timestamptz not null default now(),
  discord_notified_at timestamptz,
  constraint testflight_waitlist_email_check
    check (char_length(btrim(email)) between 3 and 320),
  constraint testflight_waitlist_email_normalized_unique
    unique (email_normalized)
);

create index if not exists testflight_waitlist_created_at_idx
  on public.testflight_waitlist (created_at asc, id asc);

alter table public.testflight_waitlist enable row level security;

revoke all on table public.testflight_waitlist from public, anon, authenticated;
grant select, update on table public.testflight_waitlist to service_role;

create or replace function public.join_testflight_waitlist(p_email text)
returns table(status text, remaining integer, waitlist_position integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  existing_id bigint;
  current_total integer;
  current_position integer;
begin
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or char_length(normalized_email) > 320 then
    raise exception using errcode = '22023', message = 'email inválido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('bookroom:testflight_waitlist', 0));

  select id
    into existing_id
    from public.testflight_waitlist
   where email_normalized = normalized_email;

  select count(*)::integer
    into current_total
    from public.testflight_waitlist;

  if existing_id is not null then
    select count(*)::integer
      into current_position
      from public.testflight_waitlist
     where id <= existing_id;

    return query select 'duplicate'::text, greatest(0, 200 - current_total), current_position;
    return;
  end if;

  if current_total >= 200 then
    return query select 'full'::text, 0, null::integer;
    return;
  end if;

  insert into public.testflight_waitlist (email)
  values (normalized_email)
  returning id into existing_id;

  current_total := current_total + 1;
  return query select 'joined'::text, greatest(0, 200 - current_total), current_total;
end;
$$;

revoke all on function public.join_testflight_waitlist(text) from public, anon, authenticated;
grant execute on function public.join_testflight_waitlist(text) to service_role;

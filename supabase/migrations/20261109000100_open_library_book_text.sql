create table public.open_library_book_text (
  work_key text primary key check (work_key ~ '^/works/OL[0-9]+W$'),
  first_publish_date text,
  description_en text,
  description_pt_br text,
  subjects_en text[] not null default '{}',
  subjects_pt_br text[] not null default '{}',
  cached_at timestamptz,
  lease_until timestamptz not null default now()
);

alter table public.open_library_book_text enable row level security;
revoke all on public.open_library_book_text from anon, authenticated;
grant select (work_key, first_publish_date, description_en, description_pt_br, subjects_en, subjects_pt_br, cached_at)
  on public.open_library_book_text to anon, authenticated;
grant select, insert, update, delete on public.open_library_book_text to service_role;

create policy "Read finished catalog text"
  on public.open_library_book_text for select to anon, authenticated
  using (cached_at is not null);

create function public.claim_open_library_book_text(p_work_key text)
returns timestamptz
language sql
set search_path = ''
as $$
  insert into public.open_library_book_text (work_key, lease_until)
  values (p_work_key, now() + interval '90 seconds')
  on conflict (work_key) do update set lease_until = excluded.lease_until
  where open_library_book_text.cached_at is null and open_library_book_text.lease_until <= now()
  returning lease_until;
$$;

revoke all on function public.claim_open_library_book_text(text) from public, anon, authenticated;
grant execute on function public.claim_open_library_book_text(text) to service_role;

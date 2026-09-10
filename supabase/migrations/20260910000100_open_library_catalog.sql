create table if not exists public.open_library_books (
  work_key text primary key,
  edition_key text,
  title text not null,
  author text not null default 'Autor desconhecido',
  isbn text,
  first_publish_year integer,
  total_pages integer,
  pages_source text not null default 'open_library',
  cover_id integer,
  search_document tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(author, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint open_library_books_work_key_check
    check (work_key ~ '^/works/[A-Za-z0-9_-]+$' and char_length(work_key) <= 200),
  constraint open_library_books_edition_key_check
    check (edition_key is null or (edition_key ~ '^/books/[A-Za-z0-9_-]+$' and char_length(edition_key) <= 200)),
  constraint open_library_books_title_check
    check (char_length(btrim(title)) between 1 and 300),
  constraint open_library_books_author_check
    check (char_length(btrim(author)) between 1 and 300),
  constraint open_library_books_isbn_check
    check (isbn is null or (char_length(isbn) <= 32 and isbn ~ '^[0-9Xx-]+$')),
  constraint open_library_books_year_check
    check (first_publish_year is null or first_publish_year between 0 and 3000),
  constraint open_library_books_pages_check
    check (total_pages is null or total_pages between 1 and 99999),
  constraint open_library_books_pages_source_check
    check (pages_source in ('open_library', 'user')),
  constraint open_library_books_cover_check
    check (cover_id is null or cover_id > 0)
);

create index if not exists open_library_books_search_document_idx
  on public.open_library_books using gin (search_document);

create index if not exists open_library_books_last_seen_at_idx
  on public.open_library_books (last_seen_at desc);

alter table public.open_library_books enable row level security;

revoke all on table public.open_library_books from public, anon, authenticated;
grant select on table public.open_library_books to anon, authenticated;

drop policy if exists "Open Library catalog is readable" on public.open_library_books;
create policy "Open Library catalog is readable"
  on public.open_library_books
  for select
  to anon, authenticated
  using (true);

create or replace function public.upsert_open_library_book(
  p_work_key text,
  p_edition_key text default null,
  p_title text default null,
  p_author text default null,
  p_total_pages integer default null,
  p_pages_source text default 'open_library',
  p_isbn text default null,
  p_first_publish_year integer default null,
  p_cover_id integer default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_work_key text := btrim(coalesce(p_work_key, ''));
  normalized_edition_key text := nullif(btrim(coalesce(p_edition_key, '')), '');
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_author text := coalesce(nullif(btrim(coalesce(p_author, '')), ''), 'Autor desconhecido');
  normalized_isbn text := nullif(btrim(coalesce(p_isbn, '')), '');
  normalized_pages_source text := coalesce(nullif(btrim(coalesce(p_pages_source, '')), ''), 'open_library');
begin
  if normalized_work_key !~ '^/works/[A-Za-z0-9_-]+$' or char_length(normalized_work_key) > 200 then
    raise exception using errcode = '22023', message = 'work_key inválido';
  end if;

  if normalized_edition_key is not null
    and (normalized_edition_key !~ '^/books/[A-Za-z0-9_-]+$' or char_length(normalized_edition_key) > 200) then
    raise exception using errcode = '22023', message = 'edition_key inválido';
  end if;

  if char_length(normalized_title) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'title inválido';
  end if;

  if char_length(normalized_author) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'author inválido';
  end if;

  if normalized_isbn is not null
    and (char_length(normalized_isbn) > 32 or normalized_isbn !~ '^[0-9Xx-]+$') then
    raise exception using errcode = '22023', message = 'isbn inválido';
  end if;

  if p_first_publish_year is not null and p_first_publish_year not between 0 and 3000 then
    raise exception using errcode = '22023', message = 'first_publish_year inválido';
  end if;

  if p_cover_id is not null and p_cover_id <= 0 then
    raise exception using errcode = '22023', message = 'cover_id inválido';
  end if;

  if normalized_pages_source not in ('open_library', 'user') then
    raise exception using errcode = '22023', message = 'pages_source inválido';
  end if;

  if p_total_pages is not null and p_total_pages not between 1 and 99999 then
    raise exception using errcode = '22023', message = 'total_pages inválido';
  end if;

  if normalized_pages_source = 'user' and p_total_pages is null then
    raise exception using errcode = '22023', message = 'correção do usuário exige total_pages';
  end if;

  insert into public.open_library_books (
    work_key,
    edition_key,
    title,
    author,
    isbn,
    first_publish_year,
    total_pages,
    pages_source,
    cover_id,
    updated_at,
    last_seen_at
  ) values (
    normalized_work_key,
    normalized_edition_key,
    normalized_title,
    normalized_author,
    normalized_isbn,
    p_first_publish_year,
    p_total_pages,
    normalized_pages_source,
    p_cover_id,
    now(),
    now()
  )
  on conflict (work_key) do update set
    edition_key = coalesce(excluded.edition_key, open_library_books.edition_key),
    title = excluded.title,
    author = excluded.author,
    isbn = coalesce(excluded.isbn, open_library_books.isbn),
    first_publish_year = coalesce(excluded.first_publish_year, open_library_books.first_publish_year),
    total_pages = case
      when excluded.pages_source = 'user' then excluded.total_pages
      when open_library_books.pages_source = 'user' then open_library_books.total_pages
      else coalesce(excluded.total_pages, open_library_books.total_pages)
    end,
    pages_source = case
      when excluded.pages_source = 'user' then 'user'
      when open_library_books.pages_source = 'user' then 'user'
      else 'open_library'
    end,
    cover_id = coalesce(excluded.cover_id, open_library_books.cover_id),
    updated_at = now(),
    last_seen_at = now();
end;
$$;

revoke all on function public.upsert_open_library_book(text, text, text, text, integer, text, text, integer, integer)
  from public;
grant execute on function public.upsert_open_library_book(text, text, text, text, integer, text, text, integer, integer)
  to anon, authenticated;

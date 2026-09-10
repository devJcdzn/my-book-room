begin;

select plan(17);

select has_table('public', 'open_library_books', 'cria o catálogo Open Library');

set local role anon;

select is(
  (select count(*)::integer from public.open_library_books),
  0,
  'anon pode ler o catálogo'
);

select throws_ok(
  $$insert into public.open_library_books (work_key, title, author)
    values ('/works/OL_DIRECT', 'Escrita direta', 'Teste')$$,
  '42501',
  null,
  'anon não escreve diretamente na tabela'
);

select lives_ok(
  $$select public.upsert_open_library_book(
    '/works/OL1W',
    '/books/OL1M',
    'Livro Teste',
    'Autora Teste',
    200,
    'open_library',
    '9780439554930',
    2020,
    123
  )$$,
  'RPC aceita metadados válidos'
);

select is(
  (select count(*)::integer from public.open_library_books),
  1,
  'upsert cria uma única linha'
);

select lives_ok(
  $$select public.upsert_open_library_book(
    '/works/OL1W',
    null,
    'Livro Teste',
    'Autora Teste',
    321,
    'user'
  )$$,
  'RPC aceita correção local de páginas'
);

select is(
  (select total_pages from public.open_library_books where work_key = '/works/OL1W'),
  321,
  'correção local atualiza páginas'
);

select lives_ok(
  $$select public.upsert_open_library_book(
    '/works/OL1W',
    null,
    'Livro Teste',
    'Autora Teste',
    111,
    'open_library'
  )$$,
  'RPC aceita atualização posterior da Open Library'
);

select is(
  (select total_pages from public.open_library_books where work_key = '/works/OL1W'),
  321,
  'atualização externa não sobrescreve correção local'
);

select throws_ok(
  $$select public.upsert_open_library_book('/invalid', null, 'Livro', 'Autora')$$,
  '22023',
  null,
  'RPC rejeita work_key inválido'
);

select throws_ok(
  $$select public.upsert_open_library_book('/works/OL2W', '/invalid', 'Livro', 'Autora')$$,
  '22023',
  null,
  'RPC rejeita edition_key inválido'
);

select throws_ok(
  $$select public.upsert_open_library_book('/works/OL2W', null, '', 'Autora')$$,
  '22023',
  null,
  'RPC rejeita título vazio'
);

select throws_ok(
  $$select public.upsert_open_library_book('/works/OL2W', null, 'Livro', 'Autora', 0)$$,
  '22023',
  null,
  'RPC rejeita páginas inválidas'
);

select throws_ok(
  $$select public.upsert_open_library_book('/works/OL2W', null, 'Livro', 'Autora', 200, 'open_library', 'isbn?')$$,
  '22023',
  null,
  'RPC rejeita ISBN inválido'
);

select throws_ok(
  $$update public.open_library_books set title = 'Alterado' where work_key = '/works/OL1W'$$,
  '42501',
  null,
  'anon não atualiza diretamente a tabela'
);

select throws_ok(
  $$delete from public.open_library_books where work_key = '/works/OL1W'$$,
  '42501',
  null,
  'anon não exclui diretamente da tabela'
);

select * from finish();
rollback;

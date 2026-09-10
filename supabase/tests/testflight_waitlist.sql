begin;

select plan(10);

select has_table('public', 'testflight_waitlist', 'cria a waitlist do TestFlight');

set local role anon;

select throws_ok(
  $$insert into public.testflight_waitlist (email) values ('direct@example.com')$$,
  '42501',
  null,
  'anon não escreve diretamente na waitlist'
);

select throws_ok(
  $$select * from public.join_testflight_waitlist('rpc@example.com')$$,
  '42501',
  null,
  'anon não chama a RPC de reserva'
);

reset role;
set local role service_role;

select is(
  (select status from public.join_testflight_waitlist(' Reader@Example.com ')),
  'joined',
  'primeiro email reserva uma vaga'
);

select is(
  (select status from public.join_testflight_waitlist('reader@example.com')),
  'duplicate',
  'email normalizado é idempotente'
);

select is(
  (select count(*)::integer from public.testflight_waitlist),
  1,
  'duplicata não cria outra linha'
);

do $$
begin
  for index in 2..200 loop
    perform * from public.join_testflight_waitlist(format('reader-%s@example.com', index));
  end loop;
end;
$$;

select is(
  (select count(*)::integer from public.testflight_waitlist),
  200,
  'a reserva concorrente mantém o limite de 200'
);

select is(
  (select status from public.join_testflight_waitlist('overflow@example.com')),
  'full',
  'a 201a tentativa é recusada'
);

select is(
  (select status from public.join_testflight_waitlist('reader-200@example.com')),
  'duplicate',
  'duplicata continua reconhecida mesmo com a lista cheia'
);

select throws_ok(
  $$select * from public.join_testflight_waitlist('email-invalido')$$,
  '22023',
  null,
  'RPC rejeita email inválido'
);

select * from finish();
rollback;

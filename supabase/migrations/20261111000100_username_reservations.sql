create table public.username_reservations (
  email text primary key,
  username text not null,
  created_at timestamptz not null default now(),
  constraint username_reservations_email_format
    check (
      email = lower(btrim(email))
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint username_reservations_username_format
    check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint username_reservations_username_unique unique (username)
);

alter table public.username_reservations enable row level security;

revoke all on table public.username_reservations from public, anon, authenticated;
grant select, insert on table public.username_reservations to service_role;

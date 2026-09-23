-- Stand-ins for the objects Supabase manages, so that supabase/schema.sql can be
-- loaded into a plain local PostgreSQL for inspection and testing. Supabase
-- supplies all of this for real, which is why none of it appears in schema.sql.
--
-- LOCAL DEVELOPMENT ONLY -- NEVER RUN THIS AGAINST YOUR SUPABASE PROJECT.
-- It redefines auth.uid() to trust a session setting that any caller can write,
-- which would neuter the RLS policies it is meant to enforce. On Supabase the
-- same function reads a signed JWT instead. Run it only against a throwaway
-- local database, and never point .env.local at that database: the app needs
-- Supabase Auth, which does not exist here.
--
--   createdb finance_dev
--   psql -d finance_dev -f supabase/local-dev-stub.sql
--   psql -d finance_dev -f supabase/schema.sql

create schema if not exists auth;

-- Supabase's own table, trimmed to the two columns handle_new_user() reads.
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- With no JWT to verify, read a session setting instead. This is the line that
-- makes the stub unsafe outside a scratch database.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- The two roles schema.sql grants to and writes its policies for.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end
$$;

-- The policies call auth.uid(), so the role they are evaluated as needs to
-- reach into that schema.
grant usage on schema auth to anon, authenticated;

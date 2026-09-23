-- Personal Finance Tracker — schema, RLS and seed data.
-- Paste this whole file into the Supabase SQL Editor and run it.
-- Safe to re-run: tables, constraints, policies and triggers are all applied
-- idempotently.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  currency    text not null default 'PHP',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('income', 'expense')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  -- The target of the composite foreign key on transactions below. A foreign
  -- key must point at a unique constraint covering exactly those columns, and
  -- the primary key on (id) alone is not one -- so this is required, not
  -- decorative, even though id is already unique by itself.
  constraint categories_id_user_id_key unique (id, user_id)
);

create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  category_id     uuid not null,
  type            text not null check (type in ('income', 'expense')),
  amount          numeric(12, 2) not null check (amount > 0),
  occurred_on     date not null,
  notes           text,
  payment_method  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Composite, so a transaction can only name a category belonging to the SAME
  -- user. A single-column reference to categories (id) cannot express that:
  -- referential integrity checks bypass row security, so it would prove only
  -- that the id exists *somewhere* -- possibly in another user's account.
  -- Pairing category_id with user_id makes the owner part of the reference
  -- itself. The RLS policy on this table constrains user_id, and this
  -- constraint makes category_id consistent with it.
  --
  -- "no action", not "restrict": both refuse a delete that would strand a row
  -- (SQLSTATE 23503 vs 23001), so the choice has no effect on the outcome here
  -- and NO ACTION is the default. Deleting a user is safe either way -- the
  -- cascades from profiles all run before the check is evaluated, whichever
  -- order the triggers fire in.
  constraint transactions_category_id_user_id_fkey
    foreign key (category_id, user_id) references public.categories (id, user_id)
    on delete no action
);

-- Groundwork only — no UI in this build.
create table if not exists public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  name           text not null,
  target_amount  numeric(12, 2) not null check (target_amount > 0),
  saved_amount   numeric(12, 2) not null default 0,
  deadline       date,
  created_at     timestamptz not null default now()
);

create index if not exists transactions_user_id_occurred_on_idx
  on public.transactions (user_id, occurred_on desc);

-- ---------------------------------------------------------------------------
-- Column bounds
-- The Server Actions validate with zod, but PostgREST is a public API: anyone
-- holding a session can POST /rest/v1/transactions directly and skip that layer
-- entirely. There is no Server Action in the path for those requests, so the
-- limit has to exist in the table. Bounds mirror lib/validations.ts.
-- Named and applied via ALTER rather than inline in CREATE TABLE so that
-- re-running this file also upgrades a database created by an earlier version
-- of it, where "create table if not exists" is a no-op.
-- ---------------------------------------------------------------------------

alter table public.transactions drop constraint if exists transactions_notes_length;
alter table public.transactions add constraint transactions_notes_length
  check (notes is null or char_length(notes) <= 500);

alter table public.transactions drop constraint if exists transactions_payment_method_length;
alter table public.transactions add constraint transactions_payment_method_length
  check (payment_method is null or char_length(payment_method) <= 50);

-- No UI writes these two yet, but the grants below let a session reach them
-- over REST, so the bounds belong here regardless.
alter table public.categories drop constraint if exists categories_name_length;
alter table public.categories add constraint categories_name_length
  check (char_length(name) between 1 and 100);

alter table public.savings_goals drop constraint if exists savings_goals_name_length;
alter table public.savings_goals add constraint savings_goals_name_length
  check (char_length(name) between 1 and 100);

-- target_amount already has "> 0"; saved_amount was left wide open, so a goal
-- could be seeded at a negative balance.
alter table public.savings_goals drop constraint if exists savings_goals_saved_amount_non_negative;
alter table public.savings_goals add constraint savings_goals_saved_amount_non_negative
  check (saved_amount >= 0);


-- ---------------------------------------------------------------------------
-- Referential integrity: a transaction may only reference a category owned by
-- the same user. See the comment on the transactions table for why a
-- single-column foreign key cannot enforce that.
--
-- Repeated via ALTER and not only inline in CREATE TABLE, because
-- "create table if not exists" is a no-op on a database that already has the
-- table: without this block an existing database would keep the old
-- single-column constraint and its behaviour.
--
-- The drops run first, and both foreign keys go before the unique constraint:
-- the new foreign key depends on categories_id_user_id_key, so dropping that
-- constraint while either key exists fails. "transactions_category_id_fkey" is
-- the name PostgreSQL derives by default for a foreign key on
-- transactions(category_id); it is dropped so the old, weaker reference cannot
-- survive alongside the new one.
-- ---------------------------------------------------------------------------

alter table public.transactions drop constraint if exists transactions_category_id_fkey;
alter table public.transactions drop constraint if exists transactions_category_id_user_id_fkey;

alter table public.categories drop constraint if exists categories_id_user_id_key;
alter table public.categories add constraint categories_id_user_id_key unique (id, user_id);

alter table public.transactions add constraint transactions_category_id_user_id_fkey
  foreign key (category_id, user_id) references public.categories (id, user_id)
  on delete no action;

-- The referencing side of a foreign key is not indexed automatically, and the
-- RI trigger looks rows up by (category_id, user_id) on every category delete.
create index if not exists transactions_category_id_user_id_idx
  on public.transactions (category_id, user_id);


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.categories    enable row level security;
alter table public.transactions  enable row level security;
alter table public.savings_goals enable row level security;

drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile"
  on public.profiles for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users manage their own categories" on public.categories;
create policy "Users manage their own categories"
  on public.categories for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own transactions" on public.transactions;
create policy "Users manage their own transactions"
  on public.transactions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own savings goals" on public.savings_goals;
create policy "Users manage their own savings goals"
  on public.savings_goals for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.categories, public.transactions, public.savings_goals to anon;
grant select, insert, update, delete on public.profiles, public.categories, public.transactions, public.savings_goals to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New user: create the profile and seed default categories.
-- Must be SECURITY DEFINER: it runs as supabase_auth_admin, which has no
-- rights on the public schema. search_path = '' requires every reference to
-- be schema-qualified, and blocks search_path hijacking.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, type, sort_order)
  values
    (new.id, 'Salary',        'income',   1),
    (new.id, 'Freelance',     'income',   2),
    (new.id, 'Business',      'income',   3),
    (new.id, 'Investments',   'income',   4),
    (new.id, 'Other Income',  'income',   5),
    (new.id, 'Food & Dining', 'expense',  1),
    (new.id, 'Groceries',     'expense',  2),
    (new.id, 'Transport',     'expense',  3),
    (new.id, 'Rent',          'expense',  4),
    (new.id, 'Utilities',     'expense',  5),
    (new.id, 'Shopping',      'expense',  6),
    (new.id, 'Health',        'expense',  7),
    (new.id, 'Entertainment', 'expense',  8),
    (new.id, 'Education',     'expense',  9),
    (new.id, 'Savings',       'expense', 10),
    (new.id, 'Other',         'expense', 11);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

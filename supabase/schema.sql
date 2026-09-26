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
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- profiles.currency is gone. Nothing ever read or wrote it -- no TypeScript in
-- this app touches the profiles table except handle_new_user(), which inserts
-- id/full_name/avatar_url -- and the app is single-currency throughout: see
-- formatPHP in lib/format.ts, the literal in the CSV export route, and the
-- README. A column that only ever held its default is a promise the code does
-- not keep, and a future reader would reasonably assume editing it changes the
-- displayed currency.
--
-- Dropped via ALTER for the usual reason: "create table if not exists" is a
-- no-op on a database that already has the table, so removing the line above
-- would leave the column behind on every existing database. No data is lost --
-- every row holds the default 'PHP', which is also what the app hardcodes.
alter table public.profiles drop column if exists currency;

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

-- Per-user savings goals, managed at /dashboard/goals. saved_amount is capped at
-- target_amount and updated_at is maintained, both added in the sections below.
create table if not exists public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  name           text not null,
  target_amount  numeric(12, 2) not null check (target_amount > 0),
  saved_amount   numeric(12, 2) not null default 0,
  deadline       date,
  created_at     timestamptz not null default now()
);

-- One recurring spending limit per expense category, managed at
-- /dashboard/budgets. There is deliberately no month column: a row is a
-- standing rule about a category, and the page applies it to whichever month is
-- selected.
create table if not exists public.category_budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  category_id  uuid not null,
  amount       numeric(12, 2) not null check (amount > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One budget per category per user. This is also the conflict target
  -- saveBudget upserts on, so it has to sit on exactly these two columns.
  constraint category_budgets_user_id_category_id_key unique (user_id, category_id),
  -- Same composite trick as transactions: pairing category_id with user_id puts
  -- the owner inside the reference, so a budget cannot name another user's
  -- category. CASCADE here, unlike the transactions key, because a budget is a
  -- rule *about* a category and means nothing once the category is gone --
  -- whereas a category with transactions is refused rather than taking the
  -- history down with it.
  constraint category_budgets_category_id_user_id_fkey
    foreign key (category_id, user_id) references public.categories (id, user_id)
    on delete cascade
);

create index if not exists transactions_user_id_occurred_on_idx
  on public.transactions (user_id, occurred_on desc);

-- The unique constraint above indexes (user_id, category_id); the RI trigger
-- fired by a category delete looks referencing rows up by (category_id,
-- user_id), which that index cannot serve -- its leading column is user_id.
-- Same reasoning as transactions_category_id_user_id_idx below: a foreign key
-- does not index its referencing side, and no unique constraint here covers
-- (category_id, user_id).
create index if not exists category_budgets_category_id_user_id_idx
  on public.category_budgets (category_id, user_id);

-- ---------------------------------------------------------------------------
-- Column bounds
-- The Server Actions validate with zod, but PostgREST is a public API: anyone
-- holding a session can POST /rest/v1/transactions directly and skip that layer
-- entirely. There is no Server Action in the path for those requests, so the
-- limit has to exist in the table. Bounds mirror lib/validations.ts -- with one
-- gap no bound here can close: the amount columns' "at most 2 decimals" rule is
-- unenforceable at the table. numeric(12,2) rounds an over-precise value before
-- the CHECK constraints and before any BEFORE trigger see it, so only its digit
-- bound survives (an 11th digit overflows). The reasoning, and why that trade
-- is the right one, is on amountField in lib/validations.ts.
-- Named and applied via ALTER rather than inline in CREATE TABLE so that
-- re-running this file also upgrades a database created by an earlier version
-- of it, where "create table if not exists" is a no-op.
--
-- Every ADD CONSTRAINT in this section is preceded by a statement that repairs
-- the rows that bound would reject, and that is not decoration. The SQL Editor
-- runs this whole file as ONE transaction, so one ADD CONSTRAINT failing on a
-- pre-existing row rolls back every statement in the file -- tables, grants,
-- policies and functions alike -- and leaves the operator with a raw "is
-- violated by some row" naming a constraint they have never heard of. A row can
-- genuinely predate a bound: the version of this file that created the table
-- had no such bound to reject it. Each repair is a no-op on a database that
-- already satisfies the bound, which is what the ALTER form is for.
-- ---------------------------------------------------------------------------

-- Over-long values are truncated to the bound rather than deleted, so the row
-- survives with everything up to the limit. The app has never been able to write
-- one: this is the shape of a hand-inserted or pre-file row.
update public.transactions set notes = left(notes, 500) where char_length(notes) > 500;

alter table public.transactions drop constraint if exists transactions_notes_length;
alter table public.transactions add constraint transactions_notes_length
  check (notes is null or char_length(notes) <= 500);

update public.transactions set payment_method = left(payment_method, 50)
 where char_length(payment_method) > 50;

alter table public.transactions drop constraint if exists transactions_payment_method_length;
alter table public.transactions add constraint transactions_payment_method_length
  check (payment_method is null or char_length(payment_method) <= 50);

-- No UI writes these two yet, but the grants below let a session reach them
-- over REST, so the bounds belong here regardless.
--
-- "Between 1 and 100" can be violated in two directions, and only one of them
-- repairs mechanically. A long name is truncated like the notes above; an empty
-- one cannot be clamped without inventing a name, so it is given an explicit
-- marker instead. The row is kept, and the marker satisfies the same rule the
-- app applies to a name, so the category stays editable rather than becoming a
-- row the UI refuses to save.
update public.categories
   set name = case when char_length(name) = 0 then '(unnamed)' else left(name, 100) end
 where char_length(name) = 0 or char_length(name) > 100;

alter table public.categories drop constraint if exists categories_name_length;
alter table public.categories add constraint categories_name_length
  check (char_length(name) between 1 and 100);

-- The same two directions and the same repairs as categories.name above.
update public.savings_goals
   set name = case when char_length(name) = 0 then '(unnamed)' else left(name, 100) end
 where char_length(name) = 0 or char_length(name) > 100;

alter table public.savings_goals drop constraint if exists savings_goals_name_length;
alter table public.savings_goals add constraint savings_goals_name_length
  check (char_length(name) between 1 and 100);

-- target_amount already has "> 0"; saved_amount was left wide open, so a goal
-- could be seeded at a negative balance. Clamped up to the floor, the mirror of
-- the ceiling clamp below.
update public.savings_goals set saved_amount = 0 where saved_amount < 0;

alter table public.savings_goals drop constraint if exists savings_goals_saved_amount_non_negative;
alter table public.savings_goals add constraint savings_goals_saved_amount_non_negative
  check (saved_amount >= 0);

-- A goal cannot be funded past its target. The goals page enforces this in zod,
-- but that layer is skippable over REST (see the note at the top of this
-- section), so the ceiling belongs in the table too. Over-funding is repaired
-- down to the target, which is the point the goal was aiming for.
update public.savings_goals set saved_amount = target_amount where saved_amount > target_amount;

alter table public.savings_goals drop constraint if exists savings_goals_saved_amount_within_target;
alter table public.savings_goals add constraint savings_goals_saved_amount_within_target
  check (saved_amount <= target_amount);


-- ---------------------------------------------------------------------------
-- Referential integrity: a child row may only reference a category owned by the
-- same user. See the comment on the transactions table for why a single-column
-- foreign key cannot enforce that.
--
-- Repeated via ALTER and not only inline in CREATE TABLE, because
-- "create table if not exists" is a no-op on a database that already has the
-- table: without this block an existing database would keep the old
-- single-column constraint and its behaviour.
--
-- The drops run first, and every foreign key that depends on
-- categories_id_user_id_key goes before it: dropping that unique constraint
-- while a dependent key exists fails ("cannot drop constraint ... because other
-- objects depend on it"). "transactions_category_id_fkey" is the name
-- PostgreSQL derives by default for a foreign key on transactions(category_id);
-- it is dropped so the old, weaker reference cannot survive alongside the new
-- one. The category_budgets pair is not upgrading anything -- the table is new
-- in this version -- it is here so the ordering against the unique constraint is
-- fixed on every run, including the second one.
-- ---------------------------------------------------------------------------

alter table public.transactions drop constraint if exists transactions_category_id_fkey;
alter table public.transactions drop constraint if exists transactions_category_id_user_id_fkey;
alter table public.category_budgets drop constraint if exists category_budgets_category_id_user_id_fkey;

alter table public.categories drop constraint if exists categories_id_user_id_key;
alter table public.categories add constraint categories_id_user_id_key unique (id, user_id);

alter table public.transactions add constraint transactions_category_id_user_id_fkey
  foreign key (category_id, user_id) references public.categories (id, user_id)
  on delete no action;

alter table public.category_budgets add constraint category_budgets_category_id_user_id_fkey
  foreign key (category_id, user_id) references public.categories (id, user_id)
  on delete cascade;

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
alter table public.category_budgets enable row level security;

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

drop policy if exists "Users manage their own category budgets" on public.category_budgets;
create policy "Users manage their own category budgets"
  on public.category_budgets for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;

-- anon holds nothing on these tables, and this revoke -- not the grant list --
-- is what makes that true. Supabase installs ALTER DEFAULT PRIVILEGES in schema
-- public, so each table above was handed select, insert, update, delete,
-- truncate, references and trigger to anon and authenticated at CREATE TABLE
-- time, before this file could object. A grant list cannot take a privilege
-- away, which is why the "grant select to anon" line that used to sit here
-- never bound anything: the live database had already given anon full DML on
-- all five tables, category_budgets included. Only a revoke removes a
-- privilege, so this statement is the one doing the work.
--
-- anon had no data to lose: every page reads through an authenticated session.
-- The five policies above are the second barrier -- all scoped to authenticated,
-- so none of them matches an anon caller -- but RLS was never the first one here.
revoke all on public.profiles, public.categories, public.transactions,
  public.savings_goals, public.category_budgets from anon;
grant select, insert, update, delete on public.profiles, public.categories, public.transactions, public.savings_goals, public.category_budgets to authenticated;

-- ---------------------------------------------------------------------------
-- Reporting: one monthly aggregate, defined once.
-- The insights panel on /dashboard and the budgets page both consume it -- the
-- latter through a lateral join -- so month bounds live here rather than being
-- re-derived per feature.
--
-- SECURITY INVOKER is stated explicitly even though it is the default, because
-- it is the entire safety argument: the function runs with the caller's
-- privileges, so the RLS policies on both tables still apply. A SECURITY
-- DEFINER function runs as its owner and bypasses them -- one missing predicate
-- and it returns every user's rows.
--
-- SECURITY INVOKER is also the reason this is a function and not a view. A view
-- created without "with (security_invoker = true)" reads with the *owner's*
-- privileges, and the option is one careless deploy away from a silent full
-- leak. A function can also take the month as an argument, which keeps the
-- month bounds in SQL instead of drifting into TypeScript and re-aggregating
-- all history on every render.
--
-- stable, not volatile, so the planner may fold it and PostgREST treats the
-- call as read-only.
-- ---------------------------------------------------------------------------

create or replace function public.monthly_summary(p_month date)
returns table (
  category_id    uuid,
  category_name  text,
  category_type  text,
  income_total   numeric(14, 2),
  expense_total  numeric(14, 2),
  txn_count      bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    -- Snapped to the first of its month inside the function, so a hand-crafted
    -- RPC call cannot ask for an off-month range: the argument selects a month,
    -- never an arbitrary window.
    select p_month - (extract(day from p_month)::int - 1)                              as start_on,
           (p_month - (extract(day from p_month)::int - 1) + interval '1 month')::date as end_on
  )
  select c.id,
         c.name,
         c.type,
         -- Direction comes from the transaction, NOT from the category. A direct
         -- REST caller can file an expense against an income category: the keys
         -- here do not pair the two type columns. A three-column key --
         -- (category_id, user_id, type) against a unique (id, user_id, type) --
         -- would enforce it for the price of one index, but does not exist, so
         -- deriving the direction here keeps the cards and the chart in
         -- agreement about which way money moved.
         sum(case when t.type = 'income'  then t.amount else 0 end)::numeric(14, 2) as income_total,
         sum(case when t.type = 'expense' then t.amount else 0 end)::numeric(14, 2) as expense_total,
         count(*)                                                                    as txn_count
  from public.transactions t
  join public.categories c on c.id = t.category_id and c.user_id = t.user_id
  cross join bounds b
  -- Redundant against RLS on purpose: two independent defences, so a future
  -- policy regression does not become a cross-tenant read on its own. The
  -- c.user_id = t.user_id join condition above is the third.
  where t.user_id = (select auth.uid())
    and t.occurred_on >= b.start_on
    and t.occurred_on <  b.end_on
  group by c.id, c.name, c.type
  order by c.type, c.name;
$$;

-- Order matters: CREATE FUNCTION grants EXECUTE to PUBLIC by default, so the
-- revoke has to come before the grant for authenticated. anon is named
-- explicitly because the PUBLIC revoke does not reach it: Supabase's default
-- privileges grant EXECUTE on new functions in public to anon directly, and a
-- direct grant survives REVOKE ... FROM PUBLIC. Left off, the RPC stayed
-- callable with the public anon key -- returning [] rather than an error, since
-- the body's auth.uid() predicate simply matched no rows, which made it a
-- working endpoint rather than a loud one.
revoke all on function public.monthly_summary(date) from public, anon;
grant execute on function public.monthly_summary(date) to authenticated;

-- Budget vs. actual for one month: every budget the caller owns, with what has
-- been spent against its category in that month. Built on monthly_summary
-- rather than re-deriving the totals, so a limit and the chart above it can
-- never disagree about what a category cost.
--
-- LEFT JOIN LATERAL, not a plain join: a category with a budget and no spending
-- must still appear, at zero spent. The right-hand side is a set-returning
-- function over a constant argument, so "lateral" costs nothing here -- it is
-- what lets the function read the caller's rows in the same statement.
--
-- Same invoker/stable reasoning as monthly_summary above: the RLS policies on
-- category_budgets and categories still apply, and the inner call keeps applying
-- its own. remaining_amount is signed on purpose -- overspending shows as a
-- negative balance rather than being clamped, because the page has to be able to
-- say how far over the limit a category went.
--
-- Defined after monthly_summary because a language sql body is parsed and
-- resolved at CREATE time, and search_path = '' means the reference has to be
-- schema-qualified -- the function must already exist.
--
-- The budget's own id travels with the row. The page needs it for exactly one
-- thing -- the edit and delete the card offers -- and reading it from a second
-- query over category_budgets meant capping that query somewhere, after which a
-- budget the aggregate still reported had no buttons and could not be changed.
-- One source for the amounts and the identifier removes the cap and the
-- disagreement together. b.id, not b.category_id: one budget per category, so
-- the pair identifies the same row, but only the budget's own id is what a
-- delete addresses.
--
-- Dropped first: a RETURNS TABLE cannot change shape in place, so create or
-- replace fails with "cannot change return type of existing function". The
-- revoke/grant pair below re-applies to whatever this creates, and a whole-file
-- paste runs in one transaction, so nothing observes the gap.
drop function if exists public.monthly_budget_progress(date);

create or replace function public.monthly_budget_progress(p_month date)
returns table (
  category_id       uuid,
  budget_id         uuid,
  category_name     text,
  budget_amount     numeric(12, 2),
  spent_amount      numeric(14, 2),
  remaining_amount  numeric(14, 2)
)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.category_id,
         b.id,
         c.name,
         b.amount,
         coalesce(s.expense_total, 0)::numeric(14, 2),
         (b.amount - coalesce(s.expense_total, 0))::numeric(14, 2)
  from public.category_budgets b
  join public.categories c on c.id = b.category_id and c.user_id = b.user_id
  left join lateral (
    select * from public.monthly_summary(p_month)
  ) s on s.category_id = b.category_id
  where b.user_id = (select auth.uid())
  order by c.name, b.category_id;
$$;

-- anon named for the same reason as monthly_summary above: Supabase's direct
-- EXECUTE grant to anon is not undone by REVOKE ... FROM PUBLIC.
revoke all on function public.monthly_budget_progress(date) from public, anon;
grant execute on function public.monthly_budget_progress(date) to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

-- search_path pinned for the same reason as every other function here: an empty
-- search_path stops a caller-supplied schema from shadowing a name the body
-- uses. This body calls only now(), which needs no qualification -- pg_catalog
-- is searched implicitly even when search_path is empty.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A `returns trigger` function cannot be invoked directly: Postgres refuses it
-- outside a trigger ("trigger functions can only be called as triggers") and
-- PostgREST does not expose one. So PUBLIC's default EXECUTE is unreachable, and
-- no role needs a grant it can never use. Verified before revoking: a role with
-- has_function_privilege(..., 'execute') = false successfully fired a trigger,
-- because firing does not check EXECUTE.
revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- savings_goals had no updated_at while it was groundwork only. Now that a goal
-- can be edited, an UPDATE has something to record. Added via ALTER rather than
-- inline in CREATE TABLE for the same reason as the constraints above:
-- "create table if not exists" is a no-op on a database that already has the
-- table, so an existing database would never pick the column up.
alter table public.savings_goals add column if not exists updated_at timestamptz not null default now();

drop trigger if exists savings_goals_set_updated_at on public.savings_goals;
create trigger savings_goals_set_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

drop trigger if exists category_budgets_set_updated_at on public.category_budgets;
create trigger category_budgets_set_updated_at
  before update on public.category_budgets
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

-- Same as set_updated_at above: fired by a trigger on auth.users, never called.
-- SECURITY DEFINER makes an unreachable EXECUTE grant more worth removing, not
-- less -- the body runs as the definer, so the safe state is one where nothing
-- can reach it.
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

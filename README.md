# Personal Finance Tracker

A personal finance tracker built on Next.js and Supabase: Google sign-in, per-user
categories, and income/expense transaction CRUD. Per-user isolation is enforced in the
database with Row Level Security, not just in application code.

Amounts are in PHP (₱).

## Stack

- **Next.js 16** — App Router, TypeScript, Turbopack
- **Supabase** — Postgres, Auth (Google OAuth), Row Level Security
- **Tailwind CSS** + **shadcn/ui**
- **recharts** — charting, through the shadcn `chart` wrapper
- **zod** — input validation, shared between the browser form and the Server Actions

## Features

- Google OAuth sign-in, with the session refreshed on every request
- 16 default categories seeded automatically on first sign-in
- Add, edit and delete transactions — amount, type, category, date, notes, payment method
- Insights for a chosen month: income, expenses and net, plus spending by category as a
  bar chart and the same numbers as a list. The month picker scopes the panel only — the
  list below keeps its own date filters, so its pagination stays unambiguous
- Find and export: filter by type, category, date range and notes text, then download
  exactly the filtered set as CSV
- Savings goals with progress toward a target, an optional deadline, and overdue highlighting
- Add, rename and delete your own categories
- Server-side route protection: `/dashboard` redirects to `/login` when unauthenticated

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` with your Supabase project's URL and publishable key:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

   Only these two belong in the frontend. The `service_role` / secret key bypasses Row
   Level Security and must never be exposed to the browser.

3. Apply the database schema: paste the whole of `supabase/schema.sql` into the Supabase
   SQL Editor and run it. The file is idempotent, so re-running it also upgrades an
   existing database.

4. In the Supabase dashboard, enable Google as an auth provider and add
   `http://localhost:3000/auth/callback` to the redirect allowlist.

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Database

Four tables — `profiles`, `categories`, `transactions` and `savings_goals`. Row Level
Security is enabled on all four, each with a policy that constrains both `using` and
`with check`, so a session can only read and write rows it owns.

Four details worth knowing:

- **`transactions.category_id` takes part in a composite foreign key** with `user_id`,
  referencing `categories (id, user_id)`. A single-column reference would not be enough:
  referential integrity checks bypass Row Level Security, so it would prove only that
  the category id exists *somewhere* — possibly in another user's account. Pairing the
  two columns makes the owner part of the reference itself.
- **Bounds that zod also enforces are duplicated as CHECK constraints**, because
  PostgREST is a public API. A direct `POST /rest/v1/transactions` with a valid session
  never touches a Server Action, so validation that lives only in application code
  guards nothing.
- **`savings_goals.saved_amount` is capped at `target_amount`**, so a goal cannot be
  funded past its target over REST any more than through the form. The cap is added by
  an `ADD CONSTRAINT`, and the SQL Editor runs this whole file as **one transaction** —
  so the statement is preceded by a one-line `UPDATE` that clamps any pre-existing
  over-funded row. Without it, a single hand-inserted bad row would roll back every
  statement in the file. That `UPDATE` is the only statement in `schema.sql` that
  changes data, and it is a no-op unless rows were inserted by hand.
- **The monthly total is a `security invoker` SQL function, not a view.**
  `monthly_summary(p_month)` sums income and expenses per category for one month, and
  `/dashboard` calls it once per render. `security invoker` is the whole safety argument:
  the function runs with the caller's privileges, so the RLS policies still apply. A
  `security definer` function runs as its owner and bypasses them, and a view created
  without `with (security_invoker = true)` reads with the owner's privileges as well —
  either one would expose every user's rows the moment a predicate was dropped. The file
  grants execute to `authenticated` and revokes it from `public`, in that order, because
  `CREATE FUNCTION` grants it to `PUBLIC` by default.

  Two smaller notes on it. The month argument is snapped to the first of its month inside
  the function, so a hand-crafted RPC call cannot ask for an off-month range. And money
  direction is read from `transactions.type`, not from the category's, because the
  database cannot cheaply stop a direct REST caller from filing an expense under an income
  category — the cards and the chart must not disagree about which way the money moved.

## Testing the schema locally (optional)

`schema.sql` targets Supabase, so it will not load into a stock PostgreSQL on its own:
`profiles.id` references `auth.users`, the seed trigger is attached to that table, and every
policy calls `auth.uid()`. Supabase supplies all three. `supabase/local-dev-stub.sql` stubs
them so the schema can be loaded and exercised on your own machine:

```bash
createdb finance_dev
psql -d finance_dev -f supabase/local-dev-stub.sql
psql -d finance_dev -f supabase/schema.sql
```

Then you can watch the pieces work:

```sql
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select count(*) from public.categories;  -- 16, seeded by the trigger
```

The stub is local-only, and it is actively unsafe anywhere else: it redefines `auth.uid()`
to trust a session setting that any caller can write, which is precisely what the RLS
policies exist to prevent. So two rules.

- **Never run `local-dev-stub.sql` against your Supabase project**, and never point
  `.env.local` at a local database — the app needs Supabase Auth, which the stub does not
  provide.
- **Keep the password out of the repo.** Put it in `%APPDATA%\postgresql\pgpass.conf` on
  Windows (`~/.pgpass` elsewhere), which libpq reads automatically and which lives outside
  the project directory. Avoid `PGPASSWORD=...` on the command line, which ends up in your
  shell history.

One trap worth knowing: Row Level Security does not apply to a table's owner or to a
superuser, so probing the policies as `postgres` passes everything and proves nothing.
`set role authenticated` first, as above, and every check becomes meaningful.

## Project structure

```
app/                 routes — login, auth callback, dashboard
  dashboard/         transactions, categories and goals, each with its own Server Actions
components/          UI, including the form/list pair per feature
lib/
  supabase/          browser, server and proxy clients, plus cookie options
  validations.ts     zod schemas shared by client and server
  money.ts           amounts to integer cents, for sums that cannot drift
  insights.ts        normalises the aggregate payload and buckets it for the chart
supabase/schema.sql  tables, constraints, RLS policies, seed trigger, monthly aggregate
supabase/local-dev-stub.sql
                     stand-ins for Supabase's auth objects (local testing only)
proxy.ts             session refresh and route protection (Next 16's middleware)
```

## Notes

- Next.js 16 renames `middleware.ts` to `proxy.ts` and makes `cookies()`, `headers()`,
  `params` and `searchParams` async — worth knowing if you are coming from Next 14/15.
- Auth cookies are `httpOnly`, and `secure` in production. The one deliberate exception
  is the browser client, which must be able to read the short-lived PKCE verifier for the
  Google sign-in round trip.
- **Money is exact where it counts, and only where it counts.** Amounts are `numeric(12,2)`
  in Postgres, and the per-category totals are summed there, by the database. Where
  JavaScript does have to add them, `lib/money.ts` converts to integer cents first —
  `Math.round(amount * 100)` is exact for a two-decimal value — so the income, expense and
  net cards cannot drift apart, and every comparison (net positive, over budget, goal
  reached) is done on integers. What that does not promise: an individual amount is still a
  double once it is in JavaScript. The invariant is "sums and comparisons happen in cents",
  not "numbers are decimal".

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

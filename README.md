# Personal Finance Tracker

A personal finance tracker built on Next.js and Supabase: Google sign-in, per-user
categories, and income/expense transaction CRUD. Per-user isolation is enforced in the
database with Row Level Security, not just in application code.

Amounts are in PHP (₱).

## Stack

- **Next.js 16** — App Router, TypeScript, Turbopack
- **Supabase** — Postgres, Auth (Google OAuth), Row Level Security
- **Tailwind CSS** + **shadcn/ui**
- **zod** — input validation, shared between the browser form and the Server Actions

## Features

- Google OAuth sign-in, with the session refreshed on every request
- 16 default categories seeded automatically on first sign-in
- Add, edit and delete transactions — amount, type, category, date, notes, payment method
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

Four tables — `profiles`, `categories`, `transactions` and `savings_goals` (the last is
groundwork, with no UI yet). Row Level Security is enabled on all four, each with a
policy that constrains both `using` and `with check`, so a session can only read and
write rows it owns.

Two details worth knowing:

- **`transactions.category_id` takes part in a composite foreign key** with `user_id`,
  referencing `categories (id, user_id)`. A single-column reference would not be enough:
  referential integrity checks bypass Row Level Security, so it would prove only that
  the category id exists *somewhere* — possibly in another user's account. Pairing the
  two columns makes the owner part of the reference itself.
- **Bounds that zod also enforces are duplicated as CHECK constraints**, because
  PostgREST is a public API. A direct `POST /rest/v1/transactions` with a valid session
  never touches a Server Action, so validation that lives only in application code
  guards nothing.

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
  dashboard/         transaction list plus the Server Actions that mutate it
components/          UI, including the transaction form and list
lib/
  supabase/          browser, server and proxy clients, plus cookie options
  validations.ts     zod schemas shared by client and server
supabase/schema.sql  tables, constraints, RLS policies, seed trigger
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

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

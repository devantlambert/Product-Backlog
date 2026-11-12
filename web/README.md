# Roadmap app

Next.js on Vercel, with Supabase for the database and sign-in.

The screens come from `../prototype/index.html`. `npm run legacy` copies them in and points their storage at the database. Run it again whenever the prototype changes, then commit the generated files (`public/legacy/roadmap.js`, `app/legacy.css` and `lib/legacy-markup.ts`).

## How data is stored

- The app keeps one state object, the same shape as the prototype's. `lib/mapping.ts` turns it into tables and back. Each table has the columns from section 11 of the spec. Any field without a column goes into `extra`, so nothing is lost.
- Saving compares the new rows with the last saved rows and writes only what changed. Saves wait 400 ms so a drag or a burst of typing becomes one write.
- Security is row-level in Postgres (`supabase/migrations/0001_init.sql`). Anyone can read. Only profiles with the `product` or `dev` role can write. New sign-ins start as `viewer`.
- If the database is empty when an editor first opens the app, it fills it with the fictional sample data.

## Set up

1. **Supabase:** create a project. In SQL editor, paste and run `supabase/migrations/0001_init.sql`. Running it twice is safe.
2. **Sign-in links:** in Authentication > URL configuration, set Site URL to the Vercel address, and add `http://localhost:3000` under Redirect URLs for local work.
3. **Vercel:** import the Product-Backlog repo and set Root Directory to `web`. Add the Supabase integration, which sets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then redeploy.
4. **Make yourself an editor:** open the app, sign in with your email, then run this in the SQL editor:
   `update public.profiles set role = 'product' where email = 'you@example.com';`
   Reload, and the app fills itself with the sample data.

## Local work

```
npm install
npm run dev          # browser storage, unless .env.local has the Supabase settings
npm test             # mapping tests; set TEST_DATABASE_URL to also run the database tests
npm run build
```

The database tests need a Postgres with the migration applied and a stub `auth` schema (an `auth.users` table and an `auth.uid()` function). They run the real store against a small stand-in for Supabase's REST API (`tests/fake-rest.ts`).

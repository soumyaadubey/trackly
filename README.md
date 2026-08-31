# Trackly

A small app for tracking hackathon/opportunity applications, course links,
and learning roadmaps — status, deadline, tags, and notes for each, in
separate sections, filterable and searchable. No AI/LLM involved; everything
runs on Next.js + Supabase's free tiers.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Supabase** — Postgres database + email/password auth (free tier)
- **Vercel** — hosting (free tier)

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (free tier).
2. In the project dashboard, open **SQL Editor → New query**, paste the
   contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it.
   This creates the base table and locks it down with Row Level Security so
   each user can only see their own rows.
3. Open a **New query** again, paste the contents of
   [`supabase/002_add_kinds.sql`](./supabase/002_add_kinds.sql), and run it.
   This renames the table to `items` and adds support for courses and
   roadmaps alongside opportunities. (Run both files in order — `schema.sql`
   first, then `002_add_kinds.sql` — even on a brand-new project.)
4. Go to **Settings → API Keys**. Copy the **Project URL** and the
   **publishable key** (`sb_publishable_...`).
5. By default Supabase requires email confirmation for new accounts. For
   quick local testing, you can turn this off under
   **Authentication → Providers → Email → Confirm email** (disable it) so you
   can sign up and log in immediately. If the app is going to be used by
   other people, leave email confirmation **on**.

## 2. Configure environment variables

Copy the example file and fill in the values from step 1:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```

## 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to
`/login` — sign up for an account, then start adding items.

## 4. Deploy to Vercel (free)

1. Push this project to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. In the project's **Environment Variables** settings, add the same two
   variables from `.env.local`.
4. Deploy. Vercel builds and redeploys automatically on every push.

## Features

- Email/password login (Supabase Auth) — your data is private to your account
- Three sections — **Opportunities**, **Courses**, **Roadmaps** — each with
  its own status set appropriate to that kind of item
- Add an item by URL, with an "Autofill title" button that fetches the
  page's `<title>`
- Deadline tracking with overdue/due-soon highlighting
- Tags, notes, free-text search, and status filtering
- Active vs. Archive views per section so closed-out items don't clutter the list
- Privacy/Terms placeholder pages (`/privacy`, `/terms`) — replace the text
  before using this with people you don't know, it's boilerplate, not legal
  advice

## Project structure

- `src/lib/supabase/` — Supabase client setup (browser, server, and the
  session-refreshing proxy)
- `src/proxy.ts` — Next.js 16 "Proxy" (formerly `middleware.ts`) that
  refreshes the auth session and redirects signed-out users to `/login`
  (except `/login`, `/privacy`, `/terms`, which are public)
- `src/lib/items.ts` — the `Kind` (opportunity/course/roadmap) config: status
  sets, labels, styles, routes
- `src/app/items/actions.ts` — Server Actions for create/update/delete/
  status-change, shared across all three kinds, all scoped to the signed-in user
- `src/components/ItemsList.tsx` / `ItemForm.tsx` — shared list and form UI,
  parameterized by kind
- `supabase/schema.sql` + `supabase/002_add_kinds.sql` — database schema,
  RLS policies, and the kind/status migration

## Known limitations / not done yet

- No marketing landing page yet — logged-out visitors land on `/login`
  directly. A landing page design is in progress separately.
- Privacy/Terms pages are placeholder text, not reviewed legal copy.
- No custom rate limiting on signup — currently relying on Supabase Auth's
  built-in defaults, which should be revisited if usage grows.

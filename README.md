# Trackly

A small app for tracking hackathon/opportunity applications, course links,
and learning roadmaps — status, deadline, tags, and notes for each, in
separate sections, filterable and searchable. No AI/LLM involved; everything
runs on Next.js + Supabase's free tiers.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Supabase** — Postgres database + email/password auth + storage (free tier)
- **Vercel** — hosting (free tier)

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (free tier).
2. In the project dashboard, open **SQL Editor → New query**, paste the
   contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it.
   (If you set this project up with an earlier version of the schema, don't
   re-run that file — apply the numbered files in
   [`supabase/migrations/`](./supabase/migrations) in order instead.)
   This creates the `items` table (opportunities/courses/roadmaps), locks it
   down with Row Level Security so each user can only see their own rows, and
   sets up the `avatars` storage bucket for profile photos.
3. Go to **Settings → API Keys**. Copy the **Project URL** and the
   **publishable key** (`sb_publishable_...`).
4. By default Supabase requires email confirmation for new accounts. For
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
3. In the project's **Environment Variables** settings, add the same three
   variables from `.env.local`. `NEXT_PUBLIC_SITE_URL` must be your real
   deployed origin (e.g. `https://trackly.vercel.app`) — password reset links
   are built from it, and the app refuses to send one without it rather than
   fall back to a header an attacker can forge.
4. Deploy. Vercel builds and redeploys automatically on every push.
5. In Supabase, go to **Authentication → URL Configuration** and add your
   Vercel domain to the allowed redirect URLs (needed for the password reset
   email link to work in production).

## Features

- Email/password login (Supabase Auth) — your data is private to your account
- Three sections — **Opportunities**, **Courses**, **Roadmaps** — each with
  its own status set appropriate to that kind of item
- Add an item by URL, with an "Autofill title" button that fetches the
  page's `<title>`
- Deadline tracking with overdue/due-soon highlighting
- Delete with an undo window, rather than a confirmation dialog
- Tags, notes, and free-text search across titles, notes **and** tags
- Click any tag to filter the list by it
- Status filtering, and Active vs. Archive views per section so closed-out
  items don't clutter the list
- Profile: name, avatar photo, password change (requires your current password,
  and signs out other devices), a CSV export of everything you've saved, and
  self-serve account deletion
- Light/dark theme toggle

## Project structure

- `src/lib/supabase/` — Supabase client setup (browser, server, and the
  session-refreshing proxy)
- `src/proxy.ts` — Next.js 16 "Proxy" (formerly `middleware.ts`) that
  refreshes the auth session and redirects signed-out users to `/login`
  (except `/login`, `/privacy`, `/terms`, `/auth/confirm`, which are public)
- `src/lib/items.ts` — the `Kind` (opportunity/course/roadmap) config: status
  sets, labels, styles, routes
- `src/app/items/actions.ts` — Server Actions for create/update/delete/
  status-change, shared across all three kinds, all scoped to the signed-in user
- `src/components/ItemsList.tsx` / `ItemForm.tsx` — shared list and form UI,
  parameterized by kind
- `supabase/schema.sql` — full database schema, RLS policies, and storage setup

## Known limitations / not done yet

- **Deadlines are dates, not datetimes.** A hackathon deadline is usually
  "Nov 3, 11:59 PM AoE"; the app can only store `2026-11-03`. This is the next
  real schema change.
- **No reminders.** Nothing emails or notifies you — the app only helps if you
  remember to open it. A weekly digest is the obvious next feature.
- No calendar export (`.ics`), no CSV import, no bulk actions, no sort control.
- No OAuth; email and password only.
- Rate limiting on `/api/fetch-title` is in-memory, so it is per-instance and
  resets on cold start. A shared store (Vercel KV, Upstash) is the upgrade path.
- Error reporting writes structured JSON to the log rather than to a dedicated
  service. `src/lib/errors.ts` is the single seam where Sentry would be wired in.
- The Content-Security-Policy still allows `'unsafe-inline'` for scripts (the
  theme-flash guard) and styles (the app applies design tokens through inline
  `style` attributes). Both are removable and doing so is what would make the
  policy genuinely load-bearing.

## Development

```bash
npm run dev     # start the dev server
npm test        # unit tests (vitest)
npm run lint    # eslint
npx tsc --noEmit  # typecheck
npm run build   # production build
```

CI runs lint, typecheck, tests, and build on every push and pull request — see
`.github/workflows/ci.yml`. The test suite is run twice, once under
`TZ=Asia/Kolkata`, because the deadline helpers compare a stored `YYYY-MM-DD`
against the viewer's local "today" and are exactly the kind of code that passes
west of Greenwich and fails east of it.

## Security notes

A few decisions that are load-bearing and should not be "simplified" away:

- **`/api/fetch-title` validates the destination inside the connection's own DNS
  resolution**, not just with a pre-flight lookup. Checking once and then calling
  `fetch()` separately leaves a DNS-rebinding gap. See `createSsrfSafeDispatcher`.
- **The avatars bucket enforces its own size and MIME limits.** A signed-in user
  holds a JWT that works directly against the Storage REST API, so validation
  that lives only in the server action is advisory. SVG is excluded on purpose:
  the bucket is public and an SVG is executable content.
- **`NEXT_PUBLIC_SITE_URL` is required in production.** Password-reset links are
  built from it rather than from the request's `Host` header, so a forged header
  cannot redirect an emailed reset token to another domain.
- **Server actions filter on `user_id` in addition to the row id.** RLS already
  guarantees ownership; the redundancy is deliberate, in case a policy is ever
  dropped during a migration.
- **Every API route re-checks authentication** rather than trusting that the
  request got past the proxy. Authorization that lives only in middleware is a
  single point of failure (cf. CVE-2025-29927).

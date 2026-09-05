# Trackly

[![CI](https://github.com/soumyaadubey/trackly/actions/workflows/ci.yml/badge.svg)](https://github.com/soumyaadubey/trackly/actions/workflows/ci.yml)

**One page for every application, course and roadmap you meant to get back to.**

**[trackly-webapp.vercel.app](https://trackly-webapp.vercel.app/)**

![The Trackly landing page, showing a board of upcoming deadlines](docs/screenshot.png)

Hackathon applications, courses you started and drifted away from, roadmaps you
bookmarked and never opened again — Trackly keeps them in one list with a status,
a deadline, tags and notes, so they stop living in browser tabs.

No AI, no LLM anywhere in the product. It runs on the free tiers of Next.js,
Supabase and Vercel.

## Contents

- [Features](#features)
- [Stack](#stack)
- [Run it yourself](#run-it-yourself)
- [Deploy](#deploy)
- [Project structure](#project-structure)
- [Development](#development)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)

## Features

**Three kinds of thing, each with its own vocabulary.** Opportunities move
through *saved → applying → applied → interview* and end in accepted, rejected
or ghosted. Courses and roadmaps have their own status sets. Statuses aren't
shared across kinds just because they share a name.

**Deadlines that sort themselves.** Overdue rows stay visibly urgent, due-this-week
sit behind them, and everything further out goes quiet. Dates are rendered
against the viewer's own calendar day, computed on the server from a timezone
cookie — so a deadline reads correctly in the first HTML rather than being
corrected after hydration.

**Your data leaves whenever you want.** A CSV of everything, and an `.ics` of
your live deadlines that any calendar app can read. Each calendar event carries
a reminder the day before, which is how Trackly does notifications without
running a notification system.

**The rest.** Email/password auth with rows locked to your account by RLS ·
add an item by URL with an autofill button that fetches the page `<title>` ·
free-text search across titles, notes *and* tags · click a tag to filter by it ·
Active and Archive views per section · delete with an undo window rather than a
confirm dialog · profile with avatar, password change and self-serve account
deletion · light and dark themes.

## Stack

| | |
|---|---|
| **Next.js 16** | App Router, Server Actions, TypeScript |
| **Tailwind CSS 4** | with design tokens in `globals.css` |
| **Supabase** | Postgres, email/password auth, storage — free tier |
| **Vercel** | hosting — free tier |
| **Vitest** | unit tests · **Playwright** for rendered-output checks |

## Run it yourself

### 1. Create a Supabase project

1. Make a new project at [supabase.com](https://supabase.com) (free tier).
2. Open **SQL Editor → New query**, paste [`supabase/schema.sql`](./supabase/schema.sql),
   and run it. That creates the `items` table, locks it down with Row Level
   Security so each user only ever sees their own rows, and sets up the
   `avatars` storage bucket.

   *Already have an older schema?* Don't re-run that file — apply the numbered
   files in [`supabase/migrations/`](./supabase/migrations) in order instead.
3. From **Settings → API Keys**, copy the **Project URL** and the
   **publishable key** (`sb_publishable_…`).
4. Supabase requires email confirmation for new accounts by default. For local
   testing you can turn it off at **Authentication → Providers → Email →
   Confirm email**. If anyone else will use your instance, leave it **on**.

### 2. Set environment variables

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Run

```bash
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000), sign up, and start adding things.

## Deploy

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the same three environment variables. **`NEXT_PUBLIC_SITE_URL` must be
   your real deployed origin** — password-reset links are built from it, and the
   app refuses to send one rather than fall back to a `Host` header an attacker
   can forge.
3. In Supabase, add your deployed domain under **Authentication → URL
   Configuration**, or the reset-email link won't work in production.
4. Also worth turning on, since the app can't enforce them alone:
   **Authentication → Secure password change**, and a minimum password length
   of 8 to match the client.

Vercel redeploys on every push to `main`.

## Project structure

| Path | What lives there |
|---|---|
| `src/proxy.ts` | Next 16 "Proxy" (formerly `middleware.ts`) — refreshes the session, bounces signed-out traffic to `/login`, preserving where they were headed |
| `src/lib/items.ts` | The `Kind` config: status sets, labels, routes, field limits, and the date maths |
| `src/lib/ics.ts` | iCalendar generation — escaping, 75-octet line folding, exclusive end dates |
| `src/lib/layout.ts` | `PAGE_MEASURE`, the one width every page's chrome lines up on |
| `src/lib/supabase/` | Client setup for browser, server and proxy |
| `src/app/(app)/items/actions.ts` | Server Actions for create/update/delete/status, shared across all three kinds |
| `src/components/ItemsList.tsx`, `ItemForm.tsx` | The shared list and form, parameterised by kind |
| `src/components/LandingBoard.tsx` | The sample board on the landing page |
| `supabase/schema.sql` | Full schema, RLS policies, storage setup |

## Development

```bash
npm run dev       # dev server
npm test          # unit tests (vitest)
npm run lint      # eslint
npx tsc --noEmit  # typecheck
npm run build     # production build
```

CI runs lint, typecheck, tests and build on every push and PR
([`ci.yml`](./.github/workflows/ci.yml)). Two details in there are deliberate:

- **`next typegen` runs before `tsc`.** `PageProps` and `LayoutProps` are
  generated into `.next/types`, so on a clean checkout they don't exist yet and
  the typecheck fails with `Cannot find name 'PageProps'`. A working tree that
  has been built before hides this; CI is the only place that starts from nothing.
- **The suite runs twice, the second time under `TZ=Asia/Kolkata`.** The deadline
  helpers compare a stored `YYYY-MM-DD` against the viewer's local "today" —
  exactly the kind of code that passes west of Greenwich and fails east of it.

`playwright` is a devDependency for checking rendered output. Unit tests can't
catch a component that renders an empty box, and this repo has shipped that bug.

## Security notes

Decisions that are load-bearing and shouldn't be "simplified" away:

- **`/api/fetch-title` validates the destination inside the connection's own DNS
  resolution**, not just with a pre-flight lookup. Checking once and calling
  `fetch()` separately leaves a DNS-rebinding gap. Both halves matter: the
  pre-check is what stops a literal IP like `169.254.169.254`, because the
  dispatcher hook only fires for hostnames. See `createSsrfSafeDispatcher`.
- **Every API route re-checks authentication** instead of trusting that the
  request got past the proxy. Authorization that lives only in middleware is one
  config change — or one CVE-2025-29927 — away from being absent.
- **The avatars bucket enforces its own size and MIME limits.** A signed-in user
  holds a JWT that works directly against the Storage REST API, so validation
  living only in a server action is advisory. SVG is excluded deliberately: the
  bucket is public, and an SVG is executable content.
- **`NEXT_PUBLIC_SITE_URL` is required in production**, so a forged `Host` header
  can't redirect an emailed reset token to another domain.
- **Server actions filter on `user_id` as well as row id.** RLS already
  guarantees ownership; the redundancy is there in case a policy is ever dropped
  during a migration.
- **CSV export neutralises formula injection.** RFC 4180 quoting alone doesn't
  stop Excel and Sheets evaluating a cell that begins with `=`, `+`, `-` or `@`.
- **`.ics` export escapes TEXT values**, so a title carrying a newline can't
  inject its own calendar properties. There's a test that tries.

## Known limitations

Honest list of what isn't there:

- **Deadlines are dates, not datetimes.** A hackathon deadline is usually
  "Nov 3, 11:59 PM AoE"; the app can only hold `2026-11-03`. This is the next
  real schema change.
- **No reminder emails.** The `.ics` export with its day-before alarms is the
  workaround, not a replacement — it only helps if you actually import it.
- **The calendar export is a download, not a subscription.** A live feed URL
  needs a per-user secret and a way to revoke it; that hasn't been designed yet,
  so re-export when things change.
- No CSV import, so there's no migration path *in* from a spreadsheet.
- No bulk actions, no sort control — deadline-ascending, always.
- No OAuth. Email and password only.
- Rate limiting on `/api/fetch-title` is in-memory, so it's per-instance and
  resets on cold start. Vercel KV or Upstash is the upgrade path.
- Error reporting writes structured JSON to the log rather than to a service.
  `src/lib/errors.ts` is the single seam where Sentry would go.
- The CSP still allows `'unsafe-inline'` for scripts (the theme-flash guard) and
  styles (design tokens are applied through inline `style` attributes). Removing
  both is what would make the policy genuinely load-bearing.

# Trackly

[![CI](https://github.com/soumyaadubey/trackly/actions/workflows/ci.yml/badge.svg)](https://github.com/soumyaadubey/trackly/actions/workflows/ci.yml)

Track applications, courses, and learning roadmaps with statuses, deadlines, tags,
and notes. Built for keeping personal opportunities and learning plans in one place.

**[Open Trackly](https://trackly-webapp.vercel.app/)** ·
[Architecture](docs/architecture.md) · [Verification](docs/verification.md)

![Trackly landing page with a sample deadline board](docs/screenshot.png)

The landing page shows sample data. Saving and managing your own items requires
an account; an interactive demo without signup is planned.

## Features

- Separate status workflows for opportunities, courses, and roadmaps.
- Date-only deadlines, urgency labels, and active/archive views.
- Search across titles, notes, and tags, plus status and tag filters.
- URL title lookup, item editing, and deletion with inline confirmation.
- CSV export and downloadable ICS calendars. Calendar files include a day-before
  alarm; whether it appears depends on the calendar client and import settings.
- Email/password authentication, profile photos, and account management.
- Light and dark themes.

## Engineering

Next.js 16 App Router, React, TypeScript, Tailwind CSS 4, and Supabase
Postgres/Auth/Storage. The hosted application uses Vercel.

- **Ownership and validation:** database row-level security and constraints,
  with additional ownership filters in item mutations.
- **Date handling:** UTC-anchored calendar arithmetic and a viewer-offset cookie
  for server-rendered deadline labels, with a client correction when needed.
- **Verification:** Vitest unit/contract tests, an isolated Playwright auth
  workflow, and an opt-in test against a disposable Supabase project.

See [architecture and tradeoffs](docs/architecture.md) for the request flow and
implementation boundaries. [Verification results](docs/verification.md) distinguish
observed checks from work that still needs database or deployment validation.
Usage, retention, and performance benchmarks have not yet been established.

## Current limitations

- Exports use a single database API request and can omit records above the
  configured response limit. Complete paginated export is pending.
- Undo is implemented inside the deleted row and needs to survive list
  revalidation before it can be relied on.
- Deadlines have no time or timezone. Reminder emails and calendar subscriptions
  are not implemented.
- CSV import, custom sorting, bulk actions, and Google sign-in are not implemented.
- URL lookup rate limits are per process. Errors go to structured server logs;
  external error reporting and alerts are pending.
- The production CSP permits inline scripts and styles. Further hardening and
  browser verification are planned.
- Fresh-install schema parity and real-provider authentication acceptance checks
  remain open. Follow the deployment guide rather than running `schema.sql`.

## Run locally

1. Install dependencies with `npm ci` using a compatible Node.js version
   (CI currently uses Node 20).
2. Create a disposable Supabase development project. Follow the
   [fresh installation instructions](docs/auth-deployment.md#fresh-installation)
   to apply migrations and configure authentication.
3. Copy `.env.local.example` to `.env.local` and fill in the variables below.
4. Run `npm run dev` and open `http://localhost:3000`.

| Variable | Purpose | Requirement |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Required |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase project key | Required |
| `NEXT_PUBLIC_SITE_URL` | Canonical app origin for email links | Use `http://localhost:3000` locally; required in production |
| `SUPABASE_SECRET_KEY` | Server-only admin credential for verified account deletion | Required for account deletion; never expose in browser code or untrusted previews |

Keep real credentials out of Git. Production also requires matching email
templates, redirect allowlists, provider settings, and migrations; use the
[authentication deployment guide](docs/auth-deployment.md).

## Development checks

```sh
npm run lint
npx next typegen
npx tsc --noEmit
npm test
npm run build
```

On Windows PowerShell, use `npm.cmd` and `npx.cmd` if script execution policy
blocks the `.ps1` launchers. Generate route types before typechecking a fresh
checkout.

[CI](.github/workflows/ci.yml) runs lint, route type generation, typechecking,
unit tests, a second test run under `TZ=Asia/Kolkata`, and a production build
on pushes to `main` and pull requests. It does not currently run browser or
real-database integration tests. Its build uses placeholder Supabase settings.

`npm run test:auth-browser` runs the isolated auth browser workflow; see its
[prerequisites and scope](docs/auth-deployment.md#verification). The separate
`npm run test:auth-provider` requires an explicitly configured disposable test
project. Neither script establishes production email delivery or deployment status.

## Planned work

1. Finish deployment verification and fix schema parity, exports, undo, and edit races.
2. Add database ownership tests and browser/database checks to CI.
3. Provide an interactive demo and run a small user pilot to guide product priorities.
4. Implement timezone-aware deadlines and durable reminders with retries and cancellation.
5. Publish reproducible performance measurements and measured product outcomes.

CSV import and further organization features will be prioritized from user feedback.
The items above are planned work, not shipped features or measured results.

## License

[MIT](LICENSE).

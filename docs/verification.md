# Verification record

Updated: 2026-09-28. Scope: the local working tree based on commit
`919b3d7fac666b8a914f7fba806c29c94fb3761f`, including uncommitted authentication
changes. The commit alone does not contain all the code reviewed here.

## Observed evidence

| Date | Check | Result | Limits |
| --- | --- | --- | --- |
| 2026-09-27 | `npm.cmd test` on the local Windows working tree | 11 files, 171 tests passed | Unit/contract tests; does not verify deployment, real database policies, or provider settings |
| 2026-09-28 | Documentation review against source, scripts, migration files, and CI configuration | Claims and setup instructions reconciled | Static review; no application, database, or provider changes performed |
| 2026-09-28 | Local Markdown checks and `git diff --check -- README.md` | 8 Markdown files checked; 32 local links/anchors resolve; all 56 original task IDs retained; code fences and whitespace checks passed | Local structural checks only; external URLs and rendered Markdown were not tested |

The earlier lint attempt did not produce a confirmed completion result during
review. No new lint, build, browser, or real-provider pass is claimed here.
Documentation edits do not establish additional runtime verification.

## Available checks and remaining work

| Area | Available check | Current evidence or gap |
| --- | --- | --- |
| Lint/types/build | Commands in [README](../README.md#development-checks) | Configured in CI; this record does not certify a particular hosted run |
| Auth browser workflows | `npm run test:auth-browser` | Local Auth/Storage fixture; rerun for the release revision |
| Provider password policy, recovery, RPC removal | `npm run test:auth-provider` | Pending against a disposable configured Supabase project |
| Signup/recovery email delivery | Manual disposable-account acceptance | Pending in target deployment |
| Fresh schema and upgrade equivalence | Database integration tests | Pending; `schema.sql` mismatch remains |
| Two-user database and storage isolation | Direct API integration tests | Pending |
| CRUD, undo, pagination, complete exports | Browser/database regression tests | Pending |
| Production configuration and migration state | Release checklist in [deployment guide](auth-deployment.md) | Not inspected in this review |
| Load performance, active users, retention | Reproducible benchmark and user pilot | No measurements established |

CI currently runs unit tests, including an Asia/Kolkata run, but not browser or
real-database integration tests. A production build with placeholder environment
variables verifies compilation, not connectivity or provider configuration.

## Recording future results

For each check, record the date, exact command or acceptance procedure, commit
and working-tree changes, environment, result, and a log or CI-run link when
available. Keep fixture results separate from real-provider acceptance and
production deployment. Record failures and skipped checks explicitly.

For benchmarks, include seed generation, data distribution, hardware/service
tier, concurrency, warm/cold behavior, p50/p95 latency, and errors. Label synthetic
traffic separately from actual usage. For a user pilot, define activation and
weekly retention, report cohort size and observation period, and omit personal data.

## Item title navigation — 2026-10-08

Implementation: local working tree based on `999072a`, changing `Home.tsx`,
`ItemsList.tsx`, adding `ItemTitleLink.tsx`, and updating the existing navigation
browser checks. Titles open validated saved websites in new tabs; editing has a
separate link on item lists only. Invalid stored URLs render as plain title text.

Local verification on Windows, Node.js 24.18.0:

| Command | Result |
| --- | --- |
| `npm.cmd run lint` | Passed |
| `npx.cmd next typegen` then `npx.cmd tsc --noEmit` | Passed |
| `npm.cmd test` | Initial run: 209 passed, one existing date-format test timed out; repeat: all 210 tests across 14 files passed |
| `npm.cmd run test:auth-browser` | Initial restricted run interrupted after font download failures; rerun with network access passed using local Auth/Storage/PostgREST fixtures |
| `npm.cmd run build` | Passed with network access for Google Fonts |
| `git diff --check` | Passed |

The browser checks opened a stubbed application website by mouse and keyboard
from the dashboard and Opportunities list at desktop and mobile widths, verified
that Trackly remained open and Edit reached the form, and checked overflow and
unsafe stored links. The existing suite also passed its pending/error/retry flows.
Screenshots were captured during the browser run but cleared by the later build;
no retained screenshot review is claimed.

Provider/database verification: not run for this navigation change; the browser
suite used disposable local fixture data. Production build success does not
establish live provider behavior.

Deployment: not performed. The live site still needs this application change
deployed; no database migration is required for the title-link fix.

Follow-up on 2026-10-08, same base revision and Windows environment: removed the
dashboard Edit action at the user's request and updated the existing browser
checks. `npm.cmd run lint`, `npm.cmd run test:auth-browser`, and
`git diff --check` passed. The browser run verified no dashboard edit links,
list editing, external title links, and keyboard/mobile navigation; its mobile
dashboard screenshot was visually reviewed. The run logged a destination-stream
closure during navigation but completed all assertions and browser-error checks.
Unit tests, typechecking, and production build were not repeated for this removal.
No provider/database changes or deployment were performed. The local development
server was restarted and `Invoke-WebRequest http://localhost:3000` returned 200.

## Project tree cleanup — 2026-10-08

Implementation: local working tree based on `95759ae`, initially clean. Grouped
19 shared component files under `home`, `items`, `layout`, and `ui`; moved the
browser-test helper to `scripts/helpers`; updated imports and documentation; and
removed the unreferenced `src/lib/supabase/client.ts` wrapper. Routes and component
behavior are unchanged. Compared moved files with the base revision: component
changes are limited to imports and line endings, and browser-helper content is
identical.

Local verification on Windows, Node.js 24.18.0:

| Command | Result |
| --- | --- |
| `npm.cmd run lint` | Passed |
| `npx.cmd next typegen` then `npx.cmd tsc --noEmit` | Passed |
| `npm.cmd test` | All 210 tests across 14 files passed |
| `npm.cmd run build` | First attempt blocked by a locked development-server log; passed after stopping the existing local server |
| `npm.cmd run test:auth-browser` | First attempt blocked by the existing dev server; passed after stopping it, using disposable local Auth/Storage/PostgREST fixtures |
| `git diff --check` | Passed |

Browser checks covered authentication, item mutations, pending/error/retry flows,
exports, edit conflicts, and desktop/mobile keyboard navigation. A destination
stream closure was logged during navigation; the suite completed all assertions
and browser-error checks successfully.

Provider/database verification: real-provider and schema checks were not run;
the browser suite used isolated local fixtures. No database changes were made.

Deployment: not performed. These results apply to the local cleanup working tree.
The local development server was restarted with `npm.cmd run dev -- --port 3000`;
`Invoke-WebRequest http://localhost:3000 -UseBasicParsing` returned HTTP 200.

## README refresh — 2026-10-08

Implementation: documentation-only follow-up on the cleanup working tree based
on `95759ae`. Updated the README against current source, package scripts, schema,
and CI configuration: next steps, title navigation, undo lifetime, edit conflicts,
paginated exports and their limits, reorganized directories, and integration checks.
Removed completed work from the planned-work list.

Local verification on Windows, Node.js 24.18.0: an inline Node.js check run via
PowerShell (`@'…'@ | node`) validated README local links/anchors, code fences,
documented npm scripts, and component directories. `git diff --check -- README.md
docs/verification.md` passed. Application tests, lint, typechecking, build, and
browser checks were not repeated for this documentation-only change.

Provider/database verification: not run. Deployment: not performed. CI descriptions
reflect workflow configuration, not a new observed hosted CI result.

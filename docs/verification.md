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

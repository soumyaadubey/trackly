# Authentication and account deletion deployment

This change needs both application deployment and Supabase configuration. Local
browser fixtures verify the app contract, not your hosted project's Auth settings.

Reviewed: 2026-09-28 against the local working tree. These are rollout instructions,
not a claim that deployment or provider acceptance has completed. See
[verification evidence](verification.md) and the
[environment variable table](../README.md#run-locally).

## Fresh installation

Use a new Supabase development/test project before a production rollout. In order,
apply [0001](../supabase/migrations/0001_init.sql),
[0002](../supabase/migrations/0002_hardening.sql),
[0003](../supabase/migrations/0003_account_deletion.sql),
[0004](../supabase/migrations/0004_item_url_scheme.sql), and
[0005](../supabase/migrations/0005_avatar_slots.sql). Record each applied file
and its revision; a manual SQL Editor run is not automatically a CLI migration log.
Keep the project private until the full sequence and configuration are complete.

Do not use `supabase/schema.sql` as the fresh-install shortcut yet. Its generated
search column calls `array_to_string` directly, while migration 0002 uses the
immutable helper required for that expression. Fresh/upgrade equivalence still
needs database verification. The ordered migrations are the documented setup path;
this documentation update has not executed them against a real Supabase project.

Complete the configuration below, then run local and disposable-provider checks.

## Upgrade an existing deployment

1. Identify the deployed application revision and actual database objects/applied
   migrations. Save a recoverable backup and record existing provider configuration.
   Apply only missing prerequisite migrations; do not blindly replay the sequence.
2. Prepare the application release containing the verified admin deletion handler
   and configure its server-only key. Rehearse the upgrade and acceptance checks on
   a disposable project before changing the production database.
3. Schedule the coordinated cutover. Apply migration 0003 first, then promote the
   prepared application release. The old deletion action will fail during this gap;
   announce temporary account-deletion unavailability. Applying the migration first
   removes the old RPC even if application promotion fails.
4. Configure/verify the provider policy, canonical origins, allowlists, and templates
   described below. Record the transition because policy/template changes can affect
   password and email flows on older releases.
5. Use disposable accounts to verify the target deployment, including real email
   links, password changes, recovery, and storage/account deletion. Record revision,
   migration state, date, and acceptance evidence before declaring rollout complete.

If application promotion or acceptance fails, keep migration 0003 applied and
correct the release/configuration. A rollback to an older application may leave
account deletion unavailable; do not recreate the old RPC to restore it. Storage
cleanup and account deletion are not reversible by rolling back the application.
Use a verified backup recovery procedure if an unrelated migration requires recovery.

## Required configuration

1. Apply `supabase/migrations/0003_account_deletion.sql` to an existing project
   after migrations 0001 and 0002. This removes the old `delete_current_user()` RPC.
   Until it is removed, direct API callers can bypass the app's password check.
   Do not reapply migration 0002 after 0003. Follow the cutover order above;
   the old application depends on the removed RPC.
2. Add `SUPABASE_SECRET_KEY` to the server deployment environment. Use a Supabase
   secret key (`sb_secret_...`); a legacy service-role key is also accepted by the
   SDK. Never use a `NEXT_PUBLIC_` name. Only account deletion uses the isolated
   admin client. It has broad project privileges, so protect and rotate it like any
   server credential. Do not provide it to preview deployments with untrusted code.
3. In Supabase Authentication settings, enable **Require current password when
   changing password**. This is separate from **Secure password change**, which
   checks recent login (24 hours) rather than always proving the old password.
   Enable secure password change too, email confirmation, and minimum length 8.
   The installed SDK accepts `current_password`; the profile action sends it.
   Genuine recovery sessions are exempt from the provider's current-password rule.
4. Set the canonical production URL in `NEXT_PUBLIC_SITE_URL`, Supabase Site URL,
   and the redirect allowlist. Allow the app's `/auth/confirm` callback, including
   its query parameters. Keep local/test origins separate from production.
5. Configure the email templates below. Enable password-change security emails
   and verify delivery with the project's email configuration.

## Email templates

Confirm signup (the action supplies a safe callback and `next` in `.RedirectTo`):

```html
<h2>Confirm your email</h2>
<p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a></p>
```

This template expects signup through Trackly, which always supplies `.RedirectTo`
with `?next=...`. If your project also has other signup clients, use the canonical
template below instead; those clients will return to Overview:

```html
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a></p>
```

Reset password:

```html
<h2>Reset your password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Choose a new password</a></p>
```

These token-hash links work in another browser without the initiating browser's
PKCE verifier. Tokens are single-use. Supabase returns the same `otp_expired` error
for expired and already-consumed links, so the UI explains both possibilities
instead of claiming to know which occurred. Email security scanners may consume
single-use GET links; if that affects delivery, use a user-confirmed intermediate
email flow before token verification.

The callback also accepts PKCE `code` and the installed SDK's `sb_flow_id` query
parameter. Default `.ConfirmationURL` templates can use that path, but the callback
then needs the initiating browser's verifier cookies. The UI explains how to recover
when that verifier is missing. Arbitrary `next` or `type` parameters never establish
recovery authorization; the server checks provider-verified claims and the live user.

## Recovery and session behavior

The app allows password reset for 15 minutes after the provider's signed `recovery`
AMR timestamp. Refreshing a JWT does not restart that window. Ordinary signup,
password, and OAuth sessions do not qualify. After changing the password, the app
requests global sign-out. If that request fails, it attempts local sign-out and
shows a warning with a path to retry revoking other sessions from Profile. Password
success does not imply sign-out succeeded. Previously issued access tokens may
remain usable until expiry even when refresh-session revocation succeeds.

Changing a password from Profile reauthenticates, checks the returned user matches
the original user, sends `current_password`, and revokes other refresh sessions.
If revocation fails, the UI says that the password changed and offers a separate
retry. Previously issued access tokens may remain usable by APIs until expiration;
revoking refresh tokens does not promise immediate revocation everywhere. The app's
recovery check additionally calls Auth `getUser()`; rejection after revocation is
an expectation exercised by the real-provider script and remains pending verification
against the configured provider.

Account deletion uses the user's freshly verified identity, not a submitted ID.
The server lists and removes avatars through Storage, including older nested files,
then uses Auth admin deletion. Database item rows cascade from the deleted user.
Storage errors stop deletion; retrying tolerates files already removed. Cleanup and
Auth deletion are not one transaction, so a failed attempt may remove the photo
while retaining the account. Never bypass Storage using `DELETE storage.objects`.

## Verification

```sh
npm test
npm run test:auth-browser
npm run lint
npx next typegen
npx tsc --noEmit
npm run build
```

`test:auth-browser` starts a local Auth/Storage fixture on port 54329 and a Next
development server on port 3111. It overrides Supabase settings in the child process
and never reads real accounts or sends emails. Do not run another Next dev process
in this working tree simultaneously. It covers signup/confirmation, consumed links,
ordinary-session reset rejection, cross-browser token-hash recovery, confirmation
validation, password changes, revocation failure/retry, and verified account deletion.

Install dependencies with `npm ci` first. The script uses Playwright Chromium;
install its browser with `npx playwright install chromium` if missing. Keep both
ports free. On Windows, use `npm.cmd`/`npx.cmd` if PowerShell blocks `.ps1` launchers.
Record fixture results separately from the provider check below.

Before production release, run the provider check against a disposable Supabase
test project with migrations applied and the settings above enabled:

```sh
# Set these in the process environment; never commit their real values.
TRACKLY_TEST_SUPABASE_URL=http://127.0.0.1:54321
TRACKLY_TEST_SUPABASE_PUBLISHABLE_KEY=...
TRACKLY_TEST_SUPABASE_SECRET_KEY=...
npm run test:auth-provider
```

For an explicitly chosen remote **test** project also set
`TRACKLY_TEST_ALLOW_REMOTE=1`. The script creates and deletes only its own disposable
account. It verifies direct API password enforcement, recovery claims, revocation,
and removal of the deletion RPC. This is not an email-delivery test: manually verify
signup/recovery emails and exact redirect allowlists in the actual deployment too.

Primary references:

- [Password security](https://supabase.com/docs/guides/auth/password-security)
- [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Storage SQL restrictions](https://supabase.com/blog/supabase-storage-performance-security-reliability-updates)
- [Auth recovery exception](https://github.com/supabase/auth/blob/master/internal/api/user.go)

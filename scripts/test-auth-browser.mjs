// Local browser contract test. No real Supabase project, account, or email is used.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { captureScreens, createItemsFixture, checkConflictingEdits, checkEmptyStates, checkItemsBrowser, checkLinkValidation, checkNavigation, checkTitleAutofill } from "./check-items-browser.mjs";

const origin = "http://localhost:3111";
const provider = "http://localhost:54329";
const secret = "sb_secret_local_browser_fixture_only";
const users = new Map();
const sessions = new Map();
const links = new Map();
const itemsFixture = createItemsFixture();
let lastLink;
let storedPhotos = ["avatar.png"];
let removedPhotos = false;
let deletionCount = 0;
let failRevocation = false;
const jwtPart = (object) => Buffer.from(JSON.stringify(object)).toString("base64url");
function session(user, method = "password") {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: `${provider}/auth/v1`, sub: user.id, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, session_id: randomUUID(), amr: [{ method, timestamp: now }] };
  const body = `${jwtPart({ alg: "HS256", typ: "JWT" })}.${jwtPart(claims)}`;
  const access_token = `${body}.${createHmac("sha256", "fixture").update(body).digest("base64url")}`;
  sessions.set(access_token, { user, method });
  return { access_token, refresh_token: randomUUID(), expires_in: 3600, token_type: "bearer", user };
}
function link(user, type, next = "/profile") {
  const hash = randomUUID();
  links.set(hash, { user, type });
  lastLink = `${origin}/auth/confirm?token_hash=${hash}&type=${type}&next=${encodeURIComponent(next)}`;
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, provider);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const bearer = req.headers.authorization?.replace(/^Bearer /, "");
    const active = sessions.get(bearer);
    const reply = (data, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Supabase-Api-Version": "2024-01-01" });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === "/auth/v1/signup") {
      const user = { id: randomUUID(), email: body.email, role: "authenticated", aud: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: new Date().toISOString() };
      users.set(user.id, { user, password: body.password });
      const next = new URL(url.searchParams.get("redirect_to")).searchParams.get("next");
      link(user, "email", next || "/profile");
      return reply(user);
    }
    if (url.pathname === "/auth/v1/token") {
      const account = [...users.values()].find(({ user }) => user.email === body.email);
      if (!account || account.password !== body.password) return reply({ code: "invalid_credentials", msg: "Invalid credentials" }, 400);
      return reply(session(account.user));
    }
    if (url.pathname === "/auth/v1/verify") {
      const pending = links.get(body.token_hash);
      if (!pending || pending.type !== body.type) return reply({ code: "otp_expired", msg: "Expired or consumed" }, 403);
      links.delete(body.token_hash);
      return reply(session(pending.user, pending.type === "recovery" ? "recovery" : "email/signup"));
    }
    if (url.pathname === "/auth/v1/recover") {
      const account = [...users.values()].find(({ user }) => user.email === body.email);
      if (account) link(account.user, "recovery", "/reset-password");
      return reply({});
    }
    if (url.pathname === "/auth/v1/user") {
      if (!active || !users.has(active.user.id)) return reply({ code: "session_not_found", msg: "No session" }, 401);
      if (req.method === "PUT" && body.password) {
        const account = users.get(active.user.id);
        if (active.method !== "recovery" && body.current_password !== account.password) return reply({ code: "current_password_required", msg: "Current password required" }, 400);
        account.password = body.password;
      }
      return reply(active.user);
    }
    if (url.pathname === "/auth/v1/logout") {
      if (failRevocation && url.searchParams.get("scope") === "others") return reply({ code: "unexpected_failure", msg: "Fixture outage" }, 500);
      for (const [token, candidate] of sessions) {
        if (active && candidate.user.id === active.user.id &&
            (url.searchParams.get("scope") === "others" ? token !== bearer : url.searchParams.get("scope") === "local" ? token === bearer : true)) sessions.delete(token);
      }
      return reply({});
    }
    if (url.pathname.startsWith("/storage/v1/")) {
      assert.equal(bearer, secret);
      if (url.pathname === "/storage/v1/object/list/avatars") return reply(storedPhotos.map((name) => ({ id: name, name })));
      if (req.method === "DELETE") {
        assert.ok(body.prefixes.every((path) => path.startsWith(`${[...users.keys()][0]}/`)));
        storedPhotos = [];
        removedPhotos = true;
        return reply([]);
      }
    }
    if (url.pathname.startsWith("/auth/v1/admin/users/") && req.method === "DELETE") {
      assert.equal(bearer, secret);
      assert.equal(removedPhotos, true, "Photos must be removed before auth deletion");
      assert.equal(users.delete(url.pathname.split("/").at(-1)), true);
      deletionCount++;
      return reply({ user: null });
    }
    if (url.pathname === "/rest/v1/items") return itemsFixture.handle(req, res, url, body, active?.user.id);
    reply({ message: "Unknown fixture route" }, 404);
  } catch (error) {
    console.error("Fixture failure:", error.message);
    res.writeHead(500).end();
  }
});
await new Promise((resolve, reject) => server.once("error", reject).listen(54329, resolve));
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3111"], {
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: provider, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only", NEXT_PUBLIC_SITE_URL: origin, SUPABASE_SECRET_KEY: secret, NEXT_TELEMETRY_DISABLED: "1" },
});
let output = "";
app.stdout.on("data", (data) => { output = (output + data).slice(-10000); if (/Ready|Compiled/.test(String(data))) console.log(String(data).trim()); });
app.stderr.on("data", (data) => { output = (output + data).slice(-10000); console.error(String(data).trim()); });
let browser;
try {
  let ready = false;
  for (let attempts = 0; attempts < 120; attempts++) {
    if (app.exitCode !== null) throw new Error(`Next exited: ${output}`);
    try { if ((await fetch(`${origin}/login`, { signal: AbortSignal.timeout(5000) })).ok) { ready = true; break; } } catch {}
    await delay(500);
  }
  assert.ok(ready, `Next did not start: ${output}`);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.setDefaultTimeout(15000);
  const email = "phase1-fixture@example.test";
  const firstPassword = "Test-first-password-123";
  const resetPassword = "Test-reset-password-456";
  const changedPassword = "Test-changed-password-789";
  await page.goto(`${origin}/login?mode=signup&next=/profile`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(firstPassword);
  await page.getByRole("button", { name: "Sign up", exact: true }).last().click();
  await page.getByRole("heading", { name: "Check your email." }).waitFor();
  assert.ok(lastLink);
  await page.goto(lastLink);
  await page.waitForURL(`${origin}/profile`);
  console.log("PASS signup confirmation and safe return path");
  await checkItemsBrowser(page, itemsFixture, [...users.keys()][0], origin);
  await checkTitleAutofill(page, origin);
  await checkLinkValidation(page, itemsFixture, [...users.keys()][0], origin);
  await checkConflictingEdits(page, itemsFixture, [...users.keys()][0], origin);
  await checkNavigation(page, itemsFixture, [...users.keys()][0], origin);
  await checkEmptyStates(page, itemsFixture, [...users.keys()][0], origin);
  await captureScreens(page, itemsFixture, [...users.keys()][0], origin);

  // A consumed link is still explained when the browser is already signed in.
  await page.goto(lastLink);
  await page.getByRole("alert").filter({ hasText: "expired or was already used" }).waitFor();
  await page.goto(`${origin}/reset-password`);
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByLabel("Confirm new password").fill(resetPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await page.getByRole("alert").filter({ hasText: "fresh password-reset" }).waitFor();
  assert.equal([...users.values()][0].password, firstPassword);
  console.log("PASS ordinary-session reset rejection and consumed-link feedback");

  await page.goto(`${origin}/login?mode=forgot`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.getByText("Check your email for a reset link.", { exact: true }).waitFor();
  const recoveryContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const recoveryPage = await recoveryContext.newPage();
  recoveryPage.setDefaultTimeout(15000);
  recoveryPage.on("pageerror", (error) => browserErrors.push(error.message));
  await recoveryPage.goto(lastLink);
  await recoveryPage.waitForURL(`${origin}/reset-password`);
  await recoveryPage.getByLabel("New password", { exact: true }).fill(resetPassword);
  await recoveryPage.getByLabel("Confirm new password").fill("different-password");
  await recoveryPage.getByRole("button", { name: "Update password" }).click();
  await recoveryPage.getByRole("alert").filter({ hasText: "don't match" }).waitFor();
  assert.equal(await recoveryPage.getByLabel("New password", { exact: true }).inputValue(), resetPassword);
  await recoveryPage.getByLabel("Confirm new password").fill(resetPassword);
  await recoveryPage.getByRole("button", { name: "Update password" }).click();
  await recoveryPage.getByText("Password updated. Log in with your new password.").waitFor();
  assert.equal(sessions.size, 0);
  assert.equal([...users.values()][0].password, resetPassword);
  assert.equal(await recoveryPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mkdir(".next/auth-check", { recursive: true });
  await recoveryPage.screenshot({ path: ".next/auth-check/reset-success-mobile.png", fullPage: true });
  console.log("PASS cross-browser recovery, mismatch validation, mobile success and session revocation");

  await recoveryPage.goto(`${origin}/login?next=/profile`);
  await recoveryPage.getByLabel("Email", { exact: true }).fill(email);
  await recoveryPage.getByLabel("Password", { exact: true }).fill(resetPassword);
  await recoveryPage.getByRole("button", { name: "Log in", exact: true }).last().click();
  await recoveryPage.waitForURL(`${origin}/profile`);
  failRevocation = true;
  await recoveryPage.getByLabel("Current password", { exact: true }).fill(resetPassword);
  await recoveryPage.getByLabel("New password", { exact: true }).fill(changedPassword);
  await recoveryPage.getByLabel("Confirm new password").fill(changedPassword);
  await recoveryPage.getByRole("button", { name: "Update password", exact: true }).click();
  await recoveryPage.getByRole("status").filter({ hasText: "couldn't confirm" }).waitFor();
  failRevocation = false;
  await recoveryPage.getByRole("button", { name: "Sign out other sessions", exact: true }).click();
  await recoveryPage.getByRole("status").filter({ hasText: "Other sessions can no longer" }).waitFor();
  assert.equal([...users.values()][0].password, changedPassword);
  console.log("PASS password change with current password and revocation failure/retry");

  await recoveryPage.getByRole("button", { name: "Account menu" }).click();
  await recoveryPage.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await recoveryPage.waitForURL(`${origin}/login`);
  await recoveryPage.goto(`${origin}/login?next=/profile`);
  await recoveryPage.getByLabel("Email", { exact: true }).fill(email);
  await recoveryPage.getByLabel("Password", { exact: true }).fill(changedPassword);
  await recoveryPage.getByRole("button", { name: "Log in", exact: true }).last().click();
  await recoveryPage.waitForURL(`${origin}/profile`);
  console.log("PASS logout and login with the changed password");

  await recoveryPage.getByRole("button", { name: "Delete my account", exact: true }).click();
  await recoveryPage.getByLabel("Your password", { exact: true }).fill("incorrect-password");
  await recoveryPage.getByLabel("Type DELETE to confirm").fill("DELETE");
  await recoveryPage.getByRole("button", { name: "Permanently delete" }).click();
  await recoveryPage.getByRole("alert").filter({ hasText: "isn't right" }).waitFor();
  assert.equal(deletionCount, 0);
  await recoveryPage.getByLabel("Your password", { exact: true }).fill(changedPassword);
  await recoveryPage.getByLabel("Type DELETE to confirm").fill("DELETE");
  await recoveryPage.getByRole("button", { name: "Permanently delete" }).click();
  await recoveryPage.waitForURL(`${origin}/?deleted=1`);
  assert.equal(deletionCount, 1);
  assert.equal(users.size, 0);
  assert.deepEqual(browserErrors, []);
  console.log("PASS verified deletion, storage cleanup ordering, and browser error checks");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  await browser?.close();
  app.kill("SIGTERM");
  await Promise.race([once(app, "exit"), delay(5000)]);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

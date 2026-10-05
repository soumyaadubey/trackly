// Opt-in integration check for a disposable Supabase TEST project.
// Never falls back to .env.local or the application's production credentials.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.TRACKLY_TEST_SUPABASE_URL;
const publicKey = process.env.TRACKLY_TEST_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.TRACKLY_TEST_SUPABASE_SECRET_KEY;
assert.ok(url && publicKey && secretKey, "Set all three TRACKLY_TEST_SUPABASE_* variables for a disposable test project.");
const hostname = new URL(url).hostname;
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(hostname) || process.env.TRACKLY_TEST_ALLOW_REMOTE === "1",
  "Remote tests require TRACKLY_TEST_ALLOW_REMOTE=1 and an explicitly chosen disposable test project.");
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, secretKey, options);
const client = createClient(url, publicKey, options);
const recovery = createClient(url, publicKey, options);
const email = `trackly-phase1-${randomUUID()}@example.test`;
const password = `Initial-${randomUUID()}-aA1!`;
const nextPassword = `Next-${randomUUID()}-aA1!`;
const resetPassword = `Reset-${randomUUID()}-aA1!`;
let userId;
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null, "Could not create disposable test user");
  userId = created.data.user.id;
  assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
  const missing = await client.auth.updateUser({ password: nextPassword });
  assert.equal(missing.error?.code, "current_password_required", "Enable provider current-password enforcement; direct update was not rejected correctly");
  const wrong = await client.auth.updateUser({ password: nextPassword, current_password: "incorrect" });
  assert.equal(wrong.error?.code, "current_password_mismatch", "Incorrect current password must be rejected by Auth");
  assert.equal((await client.auth.updateUser({ password: nextPassword, current_password: password })).error, null);
  console.log("PASS direct API password enforcement");

  const generated = await admin.auth.admin.generateLink({ type: "recovery", email });
  assert.equal(generated.error, null);
  const verified = await recovery.auth.verifyOtp({ token_hash: generated.data.properties.hashed_token, type: "recovery" });
  assert.equal(verified.error, null);
  const claims = await recovery.auth.getClaims();
  assert.ok(claims.data?.claims.amr.some(({ method }) => method === "recovery"), "Provider must issue signed recovery AMR");
  assert.equal((await recovery.auth.updateUser({ password: resetPassword })).error, null, "Verified recovery must work without the forgotten password");
  const recoveryToken = verified.data.session.access_token;
  assert.equal((await recovery.auth.signOut({ scope: "global" })).error, null);
  assert.ok((await recovery.auth.getUser(recoveryToken)).error, "Auth must reject a revoked recovery session");
  console.log("PASS recovery exception and session revocation");

  assert.equal((await client.auth.signInWithPassword({ email, password: resetPassword })).error, null);
  const rpc = await client.rpc("delete_current_user");
  assert.ok(["PGRST202", "42501", "42883"].includes(rpc.error?.code), "Old deletion RPC is still callable; apply migration 0003");
  assert.ok((await admin.auth.admin.getUserById(userId)).data.user, "Blocked RPC must leave account intact");
  console.log("PASS direct deletion RPC blocked");
} finally {
  if (userId) {
    const cleanup = await admin.auth.admin.deleteUser(userId);
    if (cleanup.error && cleanup.error.code !== "user_not_found") {
      console.error(`Test cleanup failed for disposable user ${userId}; remove this test user manually.`);
      process.exitCode = 1;
    }
  }
}

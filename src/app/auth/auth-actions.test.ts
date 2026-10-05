import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: { getClaims: vi.fn(), getUser: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn() },
  requireUser: vi.fn(), admin: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: mocks.auth }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/delete-account", () => ({ removeAccountData: mocks.remove }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/site", () => ({ getSiteOrigin: async () => "https://trackly.test" }));
vi.mock("@/lib/errors", () => ({ reportError: () => "test-ref", userMessage: () => "Provider error" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { updatePassword } from "@/app/reset-password/actions";
import { changePassword, deleteAccount, signOutOtherSessions } from "@/app/(app)/profile/actions";
import { login, logout, requestPasswordReset, signup } from "@/app/login/actions";

const user = { id: "11111111-1111-4111-8111-111111111111", email: "fixture@example.test" };
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  return data;
};
const passwordFields = { password: "New-password-123", confirm_password: "New-password-123", current_password: "Old-password-123" };
const state = { error: null, success: false };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue(user);
  mocks.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.auth.getClaims.mockResolvedValue({ data: { claims: { sub: user.id, role: "authenticated", session_id: "session", amr: [{ method: "recovery", timestamp: Math.floor(Date.now() / 1000) }] } }, error: null });
  mocks.auth.signInWithPassword.mockResolvedValue({ data: { user }, error: null });
  mocks.auth.updateUser.mockResolvedValue({ data: { user }, error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
  mocks.admin.mockReturnValue({ admin: true });
  mocks.remove.mockResolvedValue(undefined);
});
describe("password recovery", () => {
  it("rejects the old incomplete form without changing the password", async () => {
    expect((await updatePassword(state, form({ password: passwordFields.password }))).error).toContain("don't match");
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
  });
  it("rejects a direct action call with an ordinary session", async () => {
    mocks.auth.getClaims.mockResolvedValue({ data: { claims: { role: "authenticated", session_id: "s", amr: [{ method: "password", timestamp: Date.now() / 1000 }] } }, error: null });
    expect((await updatePassword(state, form(passwordFields))).error).toContain("fresh password-reset");
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
  });
  it("updates a verified recovery session and revokes all sessions including recovery", async () => {
    expect(await updatePassword(state, form(passwordFields))).toMatchObject({ success: true });
    expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password: passwordFields.password });
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
  it("reports password success separately from revocation failure", async () => {
    mocks.auth.signOut.mockResolvedValueOnce({ error: new Error("offline") });
    expect(await updatePassword(state, form(passwordFields))).toMatchObject({ success: true, warning: expect.stringContaining("couldn't confirm") });
    expect(mocks.auth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
  });
});
describe("profile security", () => {
  it("passes current_password to the provider after reauthentication", async () => {
    await changePassword(state, form(passwordFields));
    expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password: passwordFields.password, current_password: passwordFields.current_password });
  });
  it("does not mutate after incorrect password or identity mismatch", async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "different" } }, error: null });
    expect((await changePassword(state, form(passwordFields))).success).toBe(false);
    expect((await deleteAccount(state, form({ password: "wrong", confirmation: "DELETE" }))).error).toBeTruthy();
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not acquire admin authority without confirmation", async () => {
    await deleteAccount(state, form({ password: "right", confirmation: "" }));
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("deletes only the verified user and never a submitted target", async () => {
    await expect(deleteAccount(state, form({ password: "right", confirmation: "DELETE", user_id: "victim" }))).rejects.toThrow("redirect:/?deleted=1");
    expect(mocks.remove).toHaveBeenCalledWith({ admin: true }, user.id);
  });
  it("keeps deletion retryable and does not sign out after cleanup failure", async () => {
    mocks.remove.mockRejectedValue(new Error("storage failed"));
    expect((await deleteAccount(state, form({ password: "right", confirmation: "DELETE" }))).error).toContain("retry");
    expect(mocks.auth.signOut).not.toHaveBeenCalled();
  });
  it("fails closed without a configured admin credential", async () => {
    mocks.admin.mockReturnValue(null);
    expect((await deleteAccount(state, form({ password: "right", confirmation: "DELETE" }))).error).toContain("unavailable");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("shows a warning when password change succeeds but revocation fails", async () => {
    mocks.auth.signOut.mockResolvedValue({ error: new Error("offline") });
    expect(await changePassword(state, form(passwordFields))).toMatchObject({ success: true, warning: expect.any(String) });
    expect((await signOutOtherSessions()).success).toBe(false);
  });
});
describe("login and email requests", () => {
  it("preserves a safe login destination", async () => {
    await expect(login(state, form({ email: user.email, password: "right", next: "/courses?q=one" }))).rejects.toThrow("redirect:/courses?q=one");
  });
  it("never redirects login to another origin", async () => {
    await expect(login(state, form({ email: user.email, password: "right", next: "//evil.test" }))).rejects.toThrow("redirect:/");
  });
  it("sends signup confirmation to the configured callback", async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    expect(await signup(state, form({ email: user.email, password: "test-password", next: "/courses" }))).toMatchObject({ confirmSent: true });
    expect(mocks.auth.signUp.mock.calls[0][0].options.emailRedirectTo).toBe("https://trackly.test/auth/confirm?next=%2Fcourses");
  });
  it("does not disclose reset-email existence or provider failure", async () => {
    mocks.auth.resetPasswordForEmail.mockResolvedValue({ error: new Error("not found") });
    expect(await requestPasswordReset({ error: null, sent: false }, form({ email: user.email }))).toEqual({ error: null, sent: true });
  });
  it("reports logout failure and redirects successful logout", async () => {
    mocks.auth.signOut.mockResolvedValueOnce({ error: new Error("offline") });
    await expect(logout()).rejects.toThrow("redirect:/login?error=logout-failed");
    await expect(logout()).rejects.toThrow("redirect:/login");
  });
});

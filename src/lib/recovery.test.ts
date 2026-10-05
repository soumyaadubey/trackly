import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecoveryUser, hasRecentRecovery } from "./recovery";

const now = Math.floor(Date.now() / 1000);
const claims = { sub: "user-1", role: "authenticated", session_id: "session-1", amr: [{ method: "recovery", timestamp: now }] };

describe("recovery authorization", () => {
  it("requires provider recovery claims rather than user metadata", () => {
    expect(hasRecentRecovery(claims, now)).toBe(true);
    expect(hasRecentRecovery({ ...claims, amr: [{ method: "password", timestamp: now }], user_metadata: { recovery: true } }, now)).toBe(false);
  });
  it.each([now - 900, now + 1, NaN, Infinity, "today"])("rejects stale/invalid timestamp %s", (timestamp) => {
    expect(hasRecentRecovery({ ...claims, amr: [{ method: "recovery", timestamp }] }, now)).toBe(false);
  });
  it.each([null, {}, [null], [{ method: "recovery" }]])("rejects malformed AMR %s", (amr) => {
    expect(hasRecentRecovery({ ...claims, amr }, now)).toBe(false);
  });
  it("rejects unverified claims, mismatched users, and revoked sessions", async () => {
    const auth = { getClaims: vi.fn(), getUser: vi.fn() };
    const client = { auth } as unknown as SupabaseClient;
    auth.getClaims.mockResolvedValue({ data: { claims }, error: new Error("signature") });
    expect(await getRecoveryUser(client)).toBeNull();
    expect(auth.getUser).not.toHaveBeenCalled();
    auth.getClaims.mockResolvedValue({ data: { claims }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: "other-user" } }, error: null });
    expect(await getRecoveryUser(client)).toBeNull();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("revoked") });
    expect(await getRecoveryUser(client)).toBeNull();
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    expect(await getRecoveryUser(client)).toEqual({ id: "user-1" });
  });
});

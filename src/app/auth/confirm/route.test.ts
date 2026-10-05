import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => ({ verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(), getClaims: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("@/lib/site", () => ({ getSiteOrigin: async () => "https://trackly.test" }));
import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.getClaims.mockResolvedValue({ data: { claims: { amr: [{ method: "password" }] } }, error: null });
});
const request = (query: string) => new NextRequest(`https://untrusted.test/auth/confirm?${query}`);
describe("email callback", () => {
  it("keeps safe paths and query strings, using the configured origin", async () => {
    const response = await GET(request("token_hash=test&type=email&next=%2Fcourses%3Fq%3Done"));
    expect(response.headers.get("location")).toBe("https://trackly.test/courses?q=one");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("rejects external destinations", async () => {
    expect((await GET(request("token_hash=test&type=email&next=%2F%2Fevil.test"))).headers.get("location")).toBe("https://trackly.test/");
  });
  it("does not grant recovery from the next parameter", async () => {
    expect((await GET(request("token_hash=test&type=email&next=/reset-password"))).headers.get("location")).toContain("error=reset-link-invalid");
  });
  it("routes a provider-verified recovery session to reset", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "one", role: "authenticated", session_id: "s", amr: [{ method: "recovery", timestamp: Math.floor(Date.now() / 1000) }] } }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: "one" } }, error: null });
    expect((await GET(request("token_hash=test&type=recovery&next=/courses"))).headers.get("location")).toBe("https://trackly.test/reset-password");
  });
  it("supports the installed SDK's PKCE flow identifier", async () => {
    await GET(request("code=test&sb_flow_id=flow-1&next=/profile"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test", { flowId: "flow-1" });
  });
  it.each([
    ["otp_expired", "auth-link-expired"],
    ["pkce_code_verifier_not_found", "auth-link-browser"],
    ["bad_code_verifier", "auth-link-browser"],
    ["unexpected_failure", "auth-link-unavailable"],
  ])("maps provider error %s without exposing token details", async (code, expected) => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { code } });
    const location = (await GET(request("code=secret"))).headers.get("location");
    expect(location).toBe(`https://trackly.test/login?error=${expected}`);
  });
  it.each(["", "token_hash=test&type=invalid", "token_hash=test&type=recovery&code=ambiguous"])("rejects malformed callback %s", async (query) => {
    expect((await GET(request(query))).headers.get("location")).toContain("auth-link-invalid");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("describes a provider outage as retryable rather than an invalid link", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { status: 0 } });
    expect((await GET(request("token_hash=test&type=email"))).headers.get("location")).toContain("auth-link-unavailable");
  });
});

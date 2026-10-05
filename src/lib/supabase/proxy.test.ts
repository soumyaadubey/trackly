import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ loggedIn: true }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (values: unknown[]) => void } }) => ({
    auth: { getClaims: async () => {
      options.cookies.setAll([{ name: "refreshed-session", value: "new", options: { path: "/", httpOnly: true } }]);
      return { data: state.loggedIn ? { claims: { sub: "fixture" } } : null };
    } },
  }),
}));
import { updateSession } from "./proxy";
beforeEach(() => { state.loggedIn = true; });
it("preserves refreshed cookies on redirects", async () => {
  const response = await updateSession(new NextRequest("https://trackly.test/login"));
  expect(response.headers.get("location")).toBe("https://trackly.test/opportunities");
  expect(response.cookies.get("refreshed-session")?.value).toBe("new");
});
it.each(["/login?error=auth-link-expired", "/login?mode=forgot", "/reset-password"])("keeps recovery/error route %s reachable", async (path) => {
  expect((await updateSession(new NextRequest(`https://trackly.test${path}`))).headers.get("location")).toBeNull();
});
it("preserves a signed-out deep link and refresh cookies", async () => {
  state.loggedIn = false;
  const response = await updateSession(new NextRequest("https://trackly.test/courses?q=one"));
  expect(new URL(response.headers.get("location")!).searchParams.get("next")).toBe("/courses?q=one");
  expect(response.cookies.get("refreshed-session")?.value).toBe("new");
});

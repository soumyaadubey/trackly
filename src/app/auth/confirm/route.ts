import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { getSiteOrigin } from "@/lib/site";
import { getRecoveryUser } from "@/lib/recovery";
import { authLinkError } from "@/lib/auth-feedback";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = await getSiteOrigin();
  function destination(path: string) {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  const fail = (code: string) => destination(`/login?error=${code}`);
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  const next = safeNext(params.get("next"));
  if (params.has("error")) return fail(authLinkError(params.get("error_code") ?? undefined));
  const supabase = await createClient();
  if (tokenHash && !code && (type === "recovery" || type === "email" || type === "signup")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(authLinkError(error.code, error.status));
  } else if (code && !tokenHash) {
    // PKCE requires the initiating browser. Token-hash templates work across browsers.
    const flowId = params.get("sb_flow_id");
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) return fail(authLinkError(error.code, error.status));
  } else {
    return fail("auth-link-invalid");
  }
  const recoveryUser = await getRecoveryUser(supabase);
  if (recoveryUser) return destination("/reset-password");
  // A next=/reset-password parameter never grants recovery privileges.
  if (type === "recovery" || next.split("?")[0] === "/reset-password") return fail("reset-link-invalid");
  return destination(next);
}

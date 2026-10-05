import type { SupabaseClient } from "@supabase/supabase-js";

export const RECOVERY_WINDOW_SECONDS = 15 * 60;

/** Only pass claims returned by auth.getClaims(), never decoded/client metadata. */
export function hasRecentRecovery(
  claims: Record<string, unknown>,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (claims.role !== "authenticated" || typeof claims.session_id !== "string") return false;
  if (!Array.isArray(claims.amr)) return false;
  return claims.amr.some((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const { method, timestamp } = entry as Record<string, unknown>;
    return method === "recovery" && typeof timestamp === "number" &&
      Number.isFinite(timestamp) && timestamp <= now &&
      now - timestamp < RECOVERY_WINDOW_SECONDS;
  });
}

export async function getRecoveryUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data || !hasRecentRecovery(data.claims)) return null;
  // Ask the provider whether the session still exists, not just whether its
  // JWT signature is valid. This rejects a revoked recovery session.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  return !userError && user?.id === data.claims.sub ? user : null;
}

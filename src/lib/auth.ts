import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user for this request, or null.
 *
 * `supabase.auth.getUser()` is a network call to Supabase's /auth/v1/user, not
 * a local JWT decode. Rendering a single page used to make three of them — one
 * in the proxy, one in the root layout, one in the page — because nothing was
 * memoized. React's `cache()` scopes the result to the request, so the layout
 * and the page it wraps share one round-trip.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The signed-in user, or a redirect to /login.
 *
 * The proxy already redirects signed-out traffic away from protected routes;
 * this is the second lock. Middleware is a single point of failure for
 * authorization (see CVE-2025-29927), so anything that touches user data
 * re-checks here rather than trusting that the request got past the proxy.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * A Supabase client plus the verified user, for server actions.
 */
export async function requireUserClient() {
  const [supabase, user] = await Promise.all([createClient(), requireUser()]);
  return { supabase, user };
}

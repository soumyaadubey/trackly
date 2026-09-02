import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session token if needed; also validates it with Supabase.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;

  const pathname = request.nextUrl.pathname;
  const PUBLIC_PATHS = ["/login", "/privacy", "/terms", "/auth/confirm"];
  const isPublicPath = pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthRoute = pathname.startsWith("/login");

  if (!isLoggedIn && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed. Cloning the URL kept the original query
    // string, so a signed-out hit on /api/fetch-title?url=... arrived as
    // /login?url=... — someone else's parameters loose on the login page. Clear
    // it, then carry the destination in one parameter the login action reads
    // back through safeNext().
    const intended = pathname + request.nextUrl.search;
    url.search = "";
    if (intended !== "/" && !intended.startsWith("/api/")) {
      url.searchParams.set("next", intended);
    }
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/opportunities";
    return NextResponse.redirect(url);
  }

  return response;
}

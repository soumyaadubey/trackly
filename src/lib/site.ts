import { headers } from "next/headers";

/**
 * The canonical origin for links we put in outbound email.
 *
 * This deliberately does NOT trust the request's Host / X-Forwarded-Host.
 * Password-reset links used to be built from that header, so an attacker who
 * requested a reset for someone else's address while spoofing it received a
 * link pointed at their own domain — the token still valid, the victim's
 * account one click away. The only thing standing in the way was Supabase's
 * redirect allowlist, which is a dashboard setting invisible from the code.
 *
 * In production the origin comes from configuration and nowhere else. The
 * header fallback exists so local development works without a .env entry, and
 * is only consulted for loopback hosts.
 */
export async function getSiteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not set. It is required in production so that " +
        "password-reset links cannot be pointed elsewhere by a forged Host header.",
    );
  }

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const hostname = host.split(":")[0];
  const isLoopback =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

  if (!isLoopback) {
    throw new Error(
      `Refusing to derive the site origin from host "${host}". ` +
        "Set NEXT_PUBLIC_SITE_URL instead.",
    );
  }

  return `http://${host}`;
}

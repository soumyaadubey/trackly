import { NextResponse, type NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { lookup as dnsLookupCallback } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

function isPrivateIp(ip: string): boolean {
  const family = isIP(ip);

  if (family === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata endpoints
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice(7);
      return isIP(mapped) === 4 ? isPrivateIp(mapped) : true;
    }
    return false;
  }

  return true; // couldn't classify it — refuse rather than guess
}

// Re-validates the destination inside the actual connection's own DNS
// resolution, rather than relying only on the earlier one-off lookup below.
// Checking once and then calling fetch() separately leaves a DNS-rebinding
// gap: an attacker's nameserver can return a public IP for the pre-check
// and a private one (e.g. cloud metadata) moments later for the real
// connection. Pinning the check to the resolver that actually opens the
// socket closes that gap.
function createSsrfSafeDispatcher() {
  return new Agent({
    connect: {
      lookup(hostname, options, callback) {
        dnsLookupCallback(hostname, options, (err, address, family) => {
          if (err) {
            callback(err, "", 0);
            return;
          }
          const resolved = typeof address === "string" ? address : address[0]?.address;
          const resolvedFamily = typeof address === "string" ? family : address[0]?.family;
          if (!resolved || isPrivateIp(resolved)) {
            callback(new Error("Refused: resolved to a disallowed address"), "", 0);
            return;
          }
          callback(null, resolved, resolvedFamily ?? 4);
        });
      },
    },
  });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    // Fast pre-check purely for a clearer error message; the dispatcher
    // below is the actual security boundary (see createSsrfSafeDispatcher).
    const { address } = await lookup(target.hostname);
    if (isPrivateIp(address)) {
      return NextResponse.json({ error: "That address can't be fetched." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    const res = await undiciFetch(target, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (opportunity-tracker)" },
      redirect: "manual", // don't blindly follow a redirect into a private address
      dispatcher: createSsrfSafeDispatcher(),
    });
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      return NextResponse.json({ title: null });
    }
    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = match ? match[1].trim() : null;
    return NextResponse.json({ title });
  } catch {
    return NextResponse.json({ title: null });
  }
}

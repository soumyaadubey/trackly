import { NextResponse, type NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { lookup as dnsLookupCallback } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from "undici";
import { getCurrentUser } from "@/lib/auth";
import { MAX_TITLE_LENGTH } from "@/lib/items";
import { decodeEntities } from "@/lib/html";

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

          // node's dns.lookup answers with an array of {address, family} when
          // options.all is set, and undici always sets it. Normalise both shapes.
          const entries = Array.isArray(address)
            ? address
            : [{ address: address as string, family: family as number }];

          // Every candidate has to pass, not just the first. undici may fall
          // back to later entries, so a single private address anywhere in the
          // list is enough to defeat the check.
          for (const entry of entries) {
            if (!entry.address || isPrivateIp(entry.address)) {
              callback(new Error("Refused: resolved to a disallowed address"), "", 0);
              return;
            }
          }

          // Answer in the shape the caller asked for. Replying with the scalar
          // form to an all:true request is what broke this: undici reads
          // addresses[0].address off a string, gets undefined, and every fetch
          // died with "Invalid IP address: undefined" — so autofill silently
          // returned no title for every URL, always.
          if (options.all) {
            (callback as (err: null, addresses: typeof entries) => void)(null, entries);
          } else {
            callback(null, entries[0].address, entries[0].family);
          }
        });
      },
    },
  });
}

/** Longest HTML prefix we will read while looking for <title>. */
const MAX_HTML_BYTES = 512 * 1024;

/**
 * Read at most `limit` bytes of the response body.
 *
 * `res.text()` buffers whatever the remote server sends. Since the target is
 * chosen by the caller, that let anyone point this at a large file and make the
 * function allocate it — the request is authenticated, but a signed-in user
 * should still not be able to exhaust a serverless function's memory.
 */
async function readCapped(res: UndiciResponse, limit: number) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(joined.slice(0, limit));
}

/**
 * Per-user rate limit.
 *
 * In-memory, so it is per-instance and resets on cold start — deliberately
 * modest. It stops a signed-in user from turning this into a scanner or a
 * crawler in a loop. A shared store (Upstash, Vercel KV) is the upgrade path
 * once there is more than one instance to coordinate.
 */
const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(userId, recent);

  // Keep the map from growing without bound across many users.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT.windowMs)) hits.delete(key);
    }
  }

  return recent.length > RATE_LIMIT.max;
}

export async function GET(request: NextRequest) {
  // This route makes outbound requests on the server's behalf, and until now
  // the only thing gating it was the proxy. Authorization that exists solely in
  // middleware is a single point of failure (cf. CVE-2025-29927), so the check
  // is repeated where the work actually happens.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (rateLimited(user.id)) {
    return NextResponse.json(
      { error: "Too many lookups. Wait a moment." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

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
    // Both this check and the dispatcher's are load-bearing; neither is
    // redundant, and removing either opens a hole:
    //
    //   - undici only calls its `connect.lookup` for HOSTNAMES. A literal IP
    //     in the URL (http://169.254.169.254/, http://192.168.1.1/) never
    //     reaches the dispatcher at all, so THIS is the only thing that stops
    //     it. Verified: without it, a request to 192.168.1.1 connects.
    //   - This check resolves the name once, then fetch() resolves it again.
    //     An attacker's nameserver can answer public here and private there,
    //     which is what the dispatcher closes.
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

    // Only take a title from a successful response.
    //
    // Error and bot-challenge pages are still HTML with a perfectly good
    // <title>, so without this the endpoint cheerfully returns theirs. Udemy
    // answers a non-browser User-Agent with a Cloudflare interstitial —
    // 403, text/html, <title>Just a moment...</title> — and that string was
    // being written straight into the user's title field. Silently filling in
    // wrong data is worse than filling in nothing.
    if (!res.ok) {
      return NextResponse.json({ title: null });
    }

    // Only parse things that claim to be HTML. Without this, pointing the
    // lookup at a video or an archive meant downloading it to regex over bytes
    // that could never contain a <title>.
    const contentType = res.headers.get("content-type") ?? "";
    if (!/^\s*(text\/html|application\/xhtml\+xml)/i.test(contentType)) {
      return NextResponse.json({ title: null });
    }

    const html = await readCapped(res, MAX_HTML_BYTES);
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = match
      ? decodeEntities(match[1]).replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH)
      : null;
    return NextResponse.json({ title: title || null });
  } catch {
    return NextResponse.json({ title: null });
  }
}

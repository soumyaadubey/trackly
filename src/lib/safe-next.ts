/**
 * Validate a post-login destination.
 *
 * The value travels in a URL the user controls and is later handed to
 * `redirect()`, so it has to be proven to be a path on this site and nothing
 * else. Anything that could resolve to another origin is rejected outright
 * rather than sanitised — a rewritten value is a guess about intent, and the
 * safe fallback only costs the user one click.
 *
 * Rejected, and why:
 *   "https://evil.test"  absolute URL, different origin
 *   "//evil.test"        protocol-relative, resolves to another origin
 *   "/\\evil.test"       backslashes are read as slashes by some browsers
 *   "evil"               relative, resolves against wherever it lands
 */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;

  // Percent-encoding can hide any of the shapes below from a naive check.
  let candidate: string;
  try {
    candidate = decodeURIComponent(value).trim();
  } catch {
    return fallback;
  }

  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  if (candidate.includes("\\")) return fallback;

  // Control characters can smuggle a newline into a Location header.
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  // Final proof: resolved against an arbitrary origin, it must stay on it.
  try {
    const probe = new URL(candidate, "https://trackly.invalid");
    if (probe.origin !== "https://trackly.invalid") return fallback;
    return probe.pathname + probe.search;
  } catch {
    return fallback;
  }
}

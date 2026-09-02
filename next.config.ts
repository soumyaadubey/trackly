import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy.
 *
 * 'unsafe-inline' is present for scripts because the theme/timezone guard in
 * the root layout is an inline <script>, and for styles because the app applies
 * design tokens through inline style attributes. Both are removable — the
 * script by moving to a nonce, the styles by finishing the move to utility
 * classes — and doing so is what makes this policy genuinely load-bearing
 * rather than merely present.
 *
 * 'unsafe-eval' is added in development ONLY. React's dev build uses eval() to
 * reconstruct callstacks across environments; without it the console fills with
 * "eval() is not supported in this environment" and source-mapped stack traces
 * stop working. React never uses eval() in production, so the production policy
 * does not carry it — which is the whole point of gating it on NODE_ENV rather
 * than adding it globally to make a warning go away.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Avatars are served from the project's public Supabase storage bucket.
  `img-src 'self' blob: data: ${supabaseUrl}`,
  `connect-src 'self' ${supabaseUrl}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

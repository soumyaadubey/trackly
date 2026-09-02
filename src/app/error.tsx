"use client";

import { useEffect } from "react";

/**
 * The root error boundary.
 *
 * This used to destructure only `{ reset }`, throwing the error away entirely —
 * no logging, no digest, no way to correlate a user's report with a server log
 * line. The copy also said "The list didn't load" regardless of which page had
 * actually failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server has already logged the real cause against this digest; this
    // records the client-side view of the same failure. An error reporter
    // (Sentry et al.) hooks in here — one call covers every rendered route.
    console.error(
      JSON.stringify({
        level: "error",
        context: "react-error-boundary",
        digest: error.digest,
        message: error.message,
        at: new Date().toISOString(),
      }),
    );
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-4xl px-7 py-10">
      <div
        className="rounded px-7 py-16 text-center"
        style={{ background: "var(--paper)", border: "1px solid var(--border)" }}
      >
        <h2 className="font-serif mb-3 text-2xl" style={{ color: "var(--ink)" }}>
          That didn&apos;t load.
        </h2>
        <p className="mx-auto mb-6.5 max-w-md text-[15px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          Everything you&apos;ve saved is still there. This is the server not
          answering, and it usually answers on the second ask.
        </p>
        <button type="button" onClick={() => reset()} className="pill-btn-primary text-[14px]">
          Try again
        </button>
        {error.digest && (
          <p className="mt-6 text-[12px]" style={{ color: "var(--ink-faintest)" }}>
            Reference: <code>{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}

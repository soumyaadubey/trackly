/**
 * Turns database and storage failures into something safe to show a user, and
 * makes sure the real cause still reaches the logs.
 *
 * Previously every action did `return { error: error.message }`, which put raw
 * PostgREST text in front of the user — "new row for relation \"items\"
 * violates check constraint \"items_status_check\"". That is both a poor
 * experience and unnecessary schema disclosure.
 */

export type ErrorRef = string;

type Loggable = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

const FRIENDLY_BY_CODE: Record<string, string> = {
  // check_violation — a per-kind status rule or a length limit.
  "23514": "That value isn't allowed here. Check the status and field lengths.",
  // unique_violation
  "23505": "That already exists.",
  // foreign_key_violation
  "23503": "That refers to something which no longer exists.",
  // not_null_violation
  "23502": "Something required was left blank.",
  // string_data_right_truncation
  "22001": "That's too long. Try shortening it.",
  // insufficient_privilege — in practice, an RLS policy said no.
  "42501": "You don't have access to that.",
  // PostgREST: expected exactly one row, got none.
  PGRST116: "That item no longer exists.",
};

const GENERIC = "Something went wrong on our end. Please try again.";

/**
 * Log the real error with a short reference the user can quote back, and return
 * that reference. The structured line is picked up by Vercel's log drain as-is.
 *
 * This is the single seam where an error reporter (Sentry, Axiom, …) would be
 * wired in — one `captureException` call here covers every action and route.
 */
export function reportError(context: string, error: unknown): ErrorRef {
  const ref = crypto.randomUUID().slice(0, 8);
  const e = (error ?? {}) as Loggable;

  console.error(
    JSON.stringify({
      level: "error",
      ref,
      context,
      code: e.code,
      message: e.message ?? String(error),
      details: e.details ?? undefined,
      hint: e.hint ?? undefined,
      at: new Date().toISOString(),
    }),
  );

  return ref;
}

/**
 * Log the error, then produce user-facing copy. The reference is appended so a
 * support request can be tied back to an exact log line without the user ever
 * seeing the underlying database text.
 */
export function userMessage(context: string, error: unknown): string {
  const ref = reportError(context, error);
  const code = (error as Loggable | null)?.code;
  const friendly = (code && FRIENDLY_BY_CODE[code]) || GENERIC;
  return `${friendly} (ref: ${ref})`;
}

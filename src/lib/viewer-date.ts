import { cookies } from "next/headers";
import { todayForOffset } from "@/lib/items";

/** Cookie holding the viewer's UTC offset in minutes, written by the inline script in the root layout. */
export const TZ_COOKIE = "tzo";

/** Sanity bound: real UTC offsets run from -12:00 to +14:00. */
const MAX_OFFSET_MINUTES = 14 * 60;

/**
 * The calendar date it currently is *for the viewer*.
 *
 * The server has no way to know this on its own — Vercel runs in UTC, and
 * "today" for someone in Auckland is a different date than "today" in Los
 * Angeles for several hours a day. The client writes its offset to a cookie
 * before first paint; this reads it back so deadlines can be rendered
 * correctly on the server instead of being corrected after hydration.
 *
 * On a first-ever visit the cookie does not exist yet and this falls back to
 * UTC. DeadlineBadge checks the server's answer against the real local date
 * and corrects the rare disagreement, so that case is caught too.
 */
export async function getViewerToday(): Promise<string> {
  const store = await cookies();
  const raw = store.get(TZ_COOKIE)?.value;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  const offset =
    Number.isFinite(parsed) && Math.abs(parsed) <= MAX_OFFSET_MINUTES ? parsed : 0;
  return todayForOffset(offset);
}

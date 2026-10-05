"use client";

import { useSyncExternalStore } from "react";
import { deadlineUrgency, formatDeadline, localToday } from "@/lib/items";
import { URGENCY_STYLE } from "@/components/urgency-styles";

// Nothing to subscribe to — the viewer's calendar date doesn't change while
// they're looking at the page (a rollover at midnight resolves on next navigation).
const noopSubscribe = () => () => {};


/**
 * A deadline, rendered relative to the viewer's own calendar date.
 *
 * `today` is computed on the server from the timezone cookie, so the label is
 * already correct in the initial HTML. This component previously rendered the
 * raw ISO date during SSR and replaced it after hydration — so every row
 * visibly changed from "2026-09-11" to "Sep 11" on every single page load.
 *
 * The client still verifies the server's answer, because on a first-ever visit
 * the cookie does not exist yet and the server falls back to UTC. When the two
 * agree — which is every load after the first — nothing re-renders and there is
 * no flash. When they disagree, one correction happens and the cookie makes
 * the next request correct.
 */
export default function DeadlineBadge({
  deadline,
  today,
  showDate = false,
  actionable = true,
  label,
}: {
  deadline: string;
  today: string;
  showDate?: boolean;
  /** False once the deadline no longer needs acting on (e.g. already applied): shown as a plain date. */
  actionable?: boolean;
  /** Prefix naming what the date is for, e.g. "Interview". */
  label?: string;
}) {
  // Hydrates with the server's answer, then reads the real local date. Both
  // snapshots are plain strings compared with Object.is, so when they match —
  // every load after the cookie is set — React sees no change and nothing
  // re-renders.
  const effectiveToday = useSyncExternalStore(
    noopSubscribe,
    () => localToday(),
    () => today,
  );

  const urgency = actionable ? deadlineUrgency(deadline, effectiveToday) : "normal";
  const when = formatDeadline(deadline, urgency, effectiveToday);
  const text = label ? `${label} · ${when}` : when;

  return (
    <>
      <div style={{ ...URGENCY_STYLE[urgency], fontSize: 13 }}>
        {text}
      </div>
      {showDate && (
        <div className="mt-1 text-[11px]" style={{ color: "var(--ink-faintest)" }}>
          {deadline}
        </div>
      )}
    </>
  );
}

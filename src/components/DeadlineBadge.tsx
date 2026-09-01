"use client";

import { useSyncExternalStore } from "react";
import { deadlineUrgency, formatDeadline, type Urgency } from "@/lib/items";

const noopSubscribe = () => () => {};

// True once hydrated on the client, false during SSR — without a
// setState-in-effect render, per https://react.dev/learn/you-might-not-need-an-effect
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const URGENCY_STYLE: Record<Urgency, React.CSSProperties> = {
  overdue: { color: "var(--overdue)", fontWeight: 700 },
  soon: { color: "var(--due-soon)", fontWeight: 700 },
  normal: { color: "var(--ink-muted)", fontWeight: 500 },
  none: { color: "var(--ink-faintest)", fontWeight: 400 },
};

const URGENCY_CLASS: Record<Urgency, string> = {
  overdue: "nb-overdue",
  soon: "",
  normal: "",
  none: "",
};

export default function DeadlineBadge({
  deadline,
  showDate = false,
}: {
  deadline: string;
  showDate?: boolean;
}) {
  // "Today" depends on the viewer's own timezone, which the server (often
  // UTC on Vercel) can't know. Computing urgency during SSR would guess
  // wrong for anyone west of UTC, so we render a neutral placeholder first
  // and fill in the real value client-side once mounted, rather than
  // mismatch server/client output.
  const mounted = useMounted();

  const urgency: Urgency = mounted ? deadlineUrgency(deadline) : "none";
  const label = mounted ? formatDeadline(deadline, urgency) : deadline;

  return (
    <>
      <div className={URGENCY_CLASS[urgency]} style={{ ...URGENCY_STYLE[urgency], fontSize: 13 }}>
        {label}
      </div>
      {showDate && (
        <div className="mt-1 text-[11px]" style={{ color: "var(--ink-faintest)" }}>
          {deadline}
        </div>
      )}
    </>
  );
}

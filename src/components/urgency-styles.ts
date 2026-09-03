import type { Urgency } from "@/lib/items";

/**
 * How a deadline label looks at each urgency level.
 *
 * Shared so the live badge and the landing page's sample board can't drift
 * apart — the whole point of the sample board is that it looks like the real
 * thing.
 */
export const URGENCY_STYLE: Record<Urgency, React.CSSProperties> = {
  overdue: { color: "var(--overdue)", fontWeight: 700 },
  soon: { color: "var(--due-soon)", fontWeight: 700 },
  normal: { color: "var(--ink-muted)", fontWeight: 500 },
  none: { color: "var(--ink-faintest)", fontWeight: 400 },
};

export const URGENCY_CLASS: Record<Urgency, string> = {
  overdue: "nb-overdue",
  soon: "",
  normal: "",
  none: "",
};

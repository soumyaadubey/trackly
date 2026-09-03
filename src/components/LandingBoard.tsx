import { KIND_ICON } from "@/components/icons";
import { URGENCY_CLASS, URGENCY_STYLE } from "@/components/urgency-styles";
import {
  addDays,
  deadlineUrgency,
  formatDeadline,
  KIND_CONFIG,
  type Kind,
} from "@/lib/items";
import { getViewerToday } from "@/lib/viewer-date";

/**
 * The sample board on the signed-out landing page.
 *
 * The page used to describe how scannable Trackly is ("you should be able to
 * scan the page in four seconds") without ever showing anything to scan. This
 * is that claim, demonstrated: the same rows, icons and deadline badges the
 * real "Coming up" card renders, so what a visitor sees here is what they get.
 *
 * Deadlines are held as offsets from today rather than fixed dates. A
 * hardcoded date would quietly rot — by next spring every row would read as
 * overdue and the urgency gradient the board exists to show would be gone.
 *
 * The labels are rendered here on the server rather than through
 * DeadlineBadge, which deliberately re-derives them from the *viewer's* clock.
 * That is right for real items, whose deadlines are fixed dates — someone in
 * Auckland should see their own "tomorrow". It is wrong here, because these
 * deadlines are themselves derived from the server's date, so any disagreement
 * between the two clocks shifts every offset: the row written to read "2 days
 * overdue" rendered as "1 day overdue" instead. The offsets are the source of
 * truth, so the labels are computed against the same date that produced them.
 */
const SAMPLE: { kind: Kind; title: string; offsetDays: number }[] = [
  { kind: "opportunity", title: "MLH Fellowship — Fall '26", offsetDays: -2 },
  { kind: "opportunity", title: "ETHIndia 2026 — team application", offsetDays: 3 },
  { kind: "roadmap", title: "Systems design roadmap — step 3 of 9", offsetDays: 6 },
  { kind: "course", title: "MIT 6.824 — lab 2 writeup", offsetDays: 12 },
  { kind: "opportunity", title: "Winter internship — first round", offsetDays: 29 },
];

export default async function LandingBoard() {
  const today = await getViewerToday();

  return (
    <div
      className="rounded"
      style={{ background: "var(--paper)", border: "1px solid var(--border)" }}
    >
      <div
        className="flex items-baseline justify-between gap-4 px-5 py-4 sm:px-6.5 sm:py-4.5"
        style={{ borderBottom: "1px solid var(--border-soft)" }}
      >
        <h2 className="font-serif text-[17px]" style={{ color: "var(--ink)" }}>
          Coming up
        </h2>
        {/* Says plainly that these are made up, so the board reads as a
            demonstration rather than as somebody's real data. */}
        <span
          className="font-serif shrink-0 text-[12px] italic"
          style={{ color: "var(--ink-faint)" }}
        >
          A sample board
        </span>
      </div>

      <ul>
        {SAMPLE.map((sample, i) => {
          const Icon = KIND_ICON[sample.kind];
          const deadline = addDays(today, sample.offsetDays);
          const urgency = deadlineUrgency(deadline, today);
          return (
            <li
              key={sample.title}
              className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6.5"
              style={
                i < SAMPLE.length - 1
                  ? { borderBottom: "1px solid var(--border-soft)" }
                  : undefined
              }
            >
              <Icon
                size={16}
                style={{ color: `var(--kind-${sample.kind})`, flexShrink: 0 }}
              />
              <div className="min-w-0 flex-1">
                {/* Not a link — nothing here is real, so it must not look
                    clickable. `truncate` still matters: these titles are long
                    enough to reach the deadline column on a narrow phone. */}
                <div
                  className="truncate text-[14px] font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  {sample.title}
                </div>
                <div className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  {KIND_CONFIG[sample.kind].label}
                </div>
              </div>
              <div
                className={`shrink-0 whitespace-nowrap text-[13px] ${URGENCY_CLASS[urgency]}`}
                style={URGENCY_STYLE[urgency]}
              >
                {formatDeadline(deadline, urgency, today)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

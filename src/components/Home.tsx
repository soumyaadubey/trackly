import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deadlineStatusFilter, KIND_CONFIG, KIND_ROUTE, KINDS, type Item, type Kind } from "@/lib/items";
import { reportError } from "@/lib/errors";
import DeadlineBadge from "@/components/DeadlineBadge";
import { getViewerToday } from "@/lib/viewer-date";
import { KIND_ICON } from "@/components/icons";
import { PAGE_MEASURE } from "@/lib/layout";

/** Rows shown per dashboard section; the header and "More" links carry the full counts. */
const SECTION_LIMIT = 5;

export default async function Home({ name }: { name: string }) {
  const supabase = await createClient();

  // The viewer's own calendar date, so deadline labels are correct in the
  // initial HTML rather than being corrected after hydration.
  const today = await getViewerToday();

  // Overdue and upcoming are fetched separately so a pile of old overdue
  // items can never push the next real deadline off the dashboard.
  const [overdue, upcoming, counts] = await Promise.all([
    loadSection(supabase, "overdue", today),
    loadSection(supabase, "upcoming", today),
    Promise.all(
      KINDS.map((kind) =>
        supabase
          .from("items")
          // Must be "exact" — see the note in ItemsList. A "planned" count is
          // the planner's reltuples estimate, which is meaningless at this
          // table size and renders visibly wrong numbers on the dashboard.
          .select("id", { count: "exact", head: true })
          .eq("kind", kind)
          .in("status", KIND_CONFIG[kind].activeStatuses),
      ),
    ),
  ]);

  // A failed query must never read as an empty account: a failed count is
  // shown as unknown rather than zero, and the page says what went wrong.
  const countFailures = counts.filter((result) => result.error);
  for (const result of countFailures) {
    reportError("Home.counts", result.error);
  }
  const anyFailed = countFailures.length > 0 || overdue.error || upcoming.error;
  const nothingPending = overdue.total === 0 && upcoming.total === 0;

  return (
    <div className={`mx-auto w-full ${PAGE_MEASURE} px-7 py-8`}>
      <h1 className="font-serif mb-6 text-[26px]" style={{ color: "var(--ink)" }}>
        Welcome back,{" "}
        <span className="relative inline-block font-serif italic" style={{ color: "var(--accent)" }}>
          {name}
          <svg
            width="100%"
            height="10"
            viewBox="0 0 118 14"
            preserveAspectRatio="none"
            style={{ position: "absolute", left: 0, bottom: -8, color: "var(--accent)" }}
            fill="none"
          >
            <path
              d="M2 9C20 3 40 3 59 7C78 11 98 11 116 5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        .
      </h1>

      {anyFailed && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded p-5"
          style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            Couldn&apos;t load part of your dashboard just now. Everything you&apos;ve
            saved is still there.
          </p>
          {/* This page is dynamic and the client router keeps dynamic pages
              for 0s by default, so navigating here runs every query again. */}
          <Link href="/" prefetch={false} className="pill-btn-secondary text-[13px]">
            Try again
          </Link>
        </div>
      )}

      {/* On phones each card is one compact row (label left, count right):
          stacked at full size, the three took most of the first screen. */}
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4">
        {KINDS.map((kind, i) => {
          const config = KIND_CONFIG[kind];
          const failed = Boolean(counts[i].error);
          const count = counts[i].count ?? 0;
          const Icon = KIND_ICON[kind];
          return (
            <Link
              key={kind}
              href={KIND_ROUTE[kind]}
              className="block overflow-hidden rounded"
              style={{ background: "var(--paper)", border: "1px solid var(--border)" }}
            >
              <div className="kind-icon-stripe" style={{ background: `var(--kind-${kind})` }} />
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:block sm:p-6">
                <div className="flex items-center gap-2 sm:mb-2.5" style={{ color: `var(--kind-${kind})` }}>
                  <Icon size={17} />
                  <span
                    className="text-[11px] font-semibold uppercase"
                    style={{ letterSpacing: "0.03em", color: "var(--ink-muted)" }}
                  >
                    {config.pluralLabel}
                  </span>
                </div>
                <div className="font-serif text-[28px] leading-none sm:text-[36px] sm:leading-normal" style={{ color: "var(--ink)" }}>
                  {failed ? <span aria-label="Count unavailable">—</span> : count}
                </div>
                <div className="mt-1 hidden text-[13px] sm:block" style={{ color: "var(--ink-muted)" }}>
                  {failed ? "couldn't load count" : `active ${config.pluralLabel.toLowerCase()}`}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-6.5 py-4.5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <h2 className="font-serif text-[17px]" style={{ color: "var(--ink)" }}>
            Coming up
          </h2>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((kind) => (
              <Link
                key={kind}
                href={`${KIND_ROUTE[kind]}/new`}
                className="pill-btn-secondary text-[13px] max-sm:px-3.5! max-sm:py-2.5!"
              >
                + {KIND_CONFIG[kind].label}
              </Link>
            ))}
          </div>
        </div>

        {nothingPending && !overdue.error && !upcoming.error ? (
          <div className="px-7 py-12 text-center">
            {/* First use reads differently from "you have items, none due". */}
            <p className="text-[15px]" style={{ color: "var(--ink-muted)" }}>
              {counts.every((c) => !c.error && (c.count ?? 0) === 0)
                ? "Nothing tracked yet. Add a hackathon, course or roadmap above; anything with a deadline shows up here."
                : "No deadlines to act on. Items without a deadline, or that you've already applied to or finished, don't show here."}
            </p>
          </div>
        ) : (
          <>
            {(overdue.total > 0 || overdue.error) && <DeadlineSection title="Overdue" section={overdue} today={today} />}
            <DeadlineSection
              title="Upcoming"
              section={upcoming}
              today={today}
              empty="No upcoming deadlines."
            />
          </>
        )}
      </div>
    </div>
  );
}

type Due = "overdue" | "upcoming";

type Section = {
  due: Due;
  items: Item[];
  /** Exact per-kind totals, so "N more" can link to each kind's filtered list. */
  perKind: Record<Kind, number>;
  total: number;
  error: boolean;
};

/**
 * One dashboard section: the first few rows across every kind, plus an exact
 * count per kind. Only items whose deadline still needs acting on count (see
 * deadlineStatuses), and the status filter has to happen in the query:
 * fetching the soonest deadlines and filtering afterwards meant a user whose
 * next few deadlines were all completed or rejected saw an empty list while
 * live deadlines sat just outside the window.
 */
async function loadSection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  due: Due,
  today: string,
): Promise<Section> {
  const byDate = <Q extends { lt: (c: string, v: string) => Q; gte: (c: string, v: string) => Q }>(
    query: Q,
  ) => (due === "overdue" ? query.lt("deadline", today) : query.gte("deadline", today));

  const [rows, ...kindCounts] = await Promise.all([
    byDate(supabase.from("items").select("*").or(deadlineStatusFilter()))
      // Overdue: most recently missed first, since those are still worth
      // chasing. Upcoming: soonest first.
      .order("deadline", { ascending: due === "upcoming" })
      .order("id", { ascending: true })
      .limit(SECTION_LIMIT)
      .returns<Item[]>(),
    ...KINDS.map((kind) =>
      byDate(
        supabase
          .from("items")
          // Exact for the same reason as the kind cards above.
          .select("id", { count: "exact", head: true })
          .eq("kind", kind)
          .in("status", KIND_CONFIG[kind].deadlineStatuses),
      ),
    ),
  ]);

  const failed = [rows, ...kindCounts].find((result) => result.error);
  if (failed?.error) {
    reportError(`Home.${due}`, failed.error);
  }

  const perKind = Object.fromEntries(
    KINDS.map((kind, i) => [kind, kindCounts[i].count ?? 0]),
  ) as Record<Kind, number>;

  return {
    due,
    items: rows.data ?? [],
    perKind,
    total: KINDS.reduce((sum, kind) => sum + perKind[kind], 0),
    error: Boolean(failed),
  };
}

function DeadlineSection({
  title,
  section,
  today,
  empty,
}: {
  title: string;
  section: Section;
  today: string;
  empty?: string;
}) {
  const { due, items, perKind, total, error } = section;
  // What is left over per kind once the shown rows are taken out, each linking
  // to that kind's list filtered the same way.
  const remaining = KINDS.map((kind) => ({
    kind,
    count: perKind[kind] - items.filter((item) => item.kind === kind).length,
  })).filter(({ count }) => count > 0);

  return (
    <section>
      <h3
        className="px-6.5 pt-4 pb-2 text-[11px] font-semibold uppercase"
        style={{ letterSpacing: "0.03em", color: "var(--ink-muted)" }}
      >
        {title} · {error ? "—" : total}
      </h3>
      {error ? (
        <p className="px-6.5 pb-4 text-[14px]" style={{ color: "var(--danger)" }}>
          Couldn&apos;t load {due} deadlines.
        </p>
      ) : items.length === 0 ? (
        <p className="px-6.5 pb-4 text-[14px]" style={{ color: "var(--ink-faint)" }}>
          {empty}
        </p>
      ) : (
        <ul>
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li
                key={item.id}
                className="row-hover flex items-center gap-3.5 px-6.5 py-3.5"
                style={{ borderBottom: "1px solid var(--border-soft)" }}
              >
                <Icon size={16} style={{ color: `var(--kind-${item.kind})`, flexShrink: 0 }} />
                <div className="min-w-0 flex-1">
                  {/* `block` is load-bearing: Link renders an <a>, which is
                      display:inline, and `truncate` does nothing on an inline
                      element because overflow doesn't apply to it. Without it a
                      long title runs straight through the kind label and the
                      deadline, and pushes the page into horizontal scroll. */}
                  <Link
                    href={`/items/${item.id}/edit`}
                    className="block truncate text-[14px] font-medium hover:underline"
                    style={{ color: "var(--ink)" }}
                  >
                    {item.title}
                  </Link>
                  {/* On its own line rather than inline after the title, so it
                      can never be displaced by a long one. */}
                  <div className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    {KIND_CONFIG[item.kind].label}
                  </div>
                </div>
                <div className="shrink-0 whitespace-nowrap text-[13px]">
                  <DeadlineBadge deadline={item.deadline!} today={today} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!error && remaining.length > 0 && (
        <p
          className="flex flex-wrap gap-x-3 gap-y-1 px-6.5 py-3 text-[13px]"
          style={{ color: "var(--ink-faint)", borderBottom: "1px solid var(--border-soft)" }}
        >
          <span>More {due}:</span>
          {remaining.map(({ kind, count }) => (
            <Link
              key={kind}
              href={`${KIND_ROUTE[kind]}?view=active&due=${due}`}
              className="hover:underline"
              style={{ color: "var(--accent)" }}
            >
              {count} {(count === 1 ? KIND_CONFIG[kind].label : KIND_CONFIG[kind].pluralLabel).toLowerCase()}
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}

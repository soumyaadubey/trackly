import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KIND_CONFIG, KIND_ROUTE, KINDS, type Item } from "@/lib/items";
import { reportError } from "@/lib/errors";
import DeadlineBadge from "@/components/DeadlineBadge";
import { getViewerToday } from "@/lib/viewer-date";
import { KIND_ICON } from "@/components/icons";

export default async function Home({ name }: { name: string }) {
  const supabase = await createClient();

  // The viewer's own calendar date, so deadline labels are correct in the
  // initial HTML rather than being corrected after hydration.
  const today = await getViewerToday();

  // Every status that counts as "still live", across all three kinds. The
  // per-kind status sets don't overlap in meaning, but they do share names
  // ("saved", "in_progress"), so a flat set is enough to filter on in SQL and
  // the kind-specific check below stays exact.
  const activeStatuses = Array.from(
    new Set(KINDS.flatMap((kind) => KIND_CONFIG[kind].activeStatuses)),
  );

  const [{ data: withDeadlines, error: upcomingError }, counts] = await Promise.all([
    supabase
      .from("items")
      .select("*")
      .not("deadline", "is", null)
      // The status filter has to happen in the query. Fetching the 30 soonest
      // deadlines and filtering afterwards meant a user whose next 30 deadlines
      // were all completed or rejected saw "Nothing with a deadline yet" while
      // live deadlines sat just outside the window.
      .in("status", activeStatuses)
      .order("deadline", { ascending: true })
      .limit(24)
      .returns<Item[]>(),
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

  if (upcomingError) {
    reportError("Home.upcoming", upcomingError);
  }

  // Narrow to the statuses that are actually active *for that item's kind* —
  // the SQL filter above is the union, so e.g. an opportunity with status
  // "in_progress" could not exist, but this keeps the rule exact either way.
  const upcoming = (withDeadlines ?? [])
    .filter((item) => KIND_CONFIG[item.kind].activeStatuses.includes(item.status))
    .slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-4xl px-7 py-8">
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

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {KINDS.map((kind, i) => {
          const config = KIND_CONFIG[kind];
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
              <div className="p-6">
                <div className="mb-2.5 flex items-center gap-2" style={{ color: `var(--kind-${kind})` }}>
                  <Icon size={17} />
                  <span
                    className="text-[11px] font-semibold uppercase"
                    style={{ letterSpacing: "0.03em", color: "var(--ink-muted)" }}
                  >
                    {config.pluralLabel}
                  </span>
                </div>
                <div className="font-serif text-[36px]" style={{ color: "var(--ink)" }}>
                  {count}
                </div>
                <div className="mt-1 text-[13px]" style={{ color: "var(--ink-muted)" }}>
                  active {config.pluralLabel.toLowerCase()}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
        <div className="px-6.5 py-4.5" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <h2 className="font-serif text-[17px]" style={{ color: "var(--ink)" }}>
            Coming up
          </h2>
        </div>

        {upcoming.length === 0 ? (
          <div className="px-7 py-12 text-center">
            <p className="text-[15px]" style={{ color: "var(--ink-muted)" }}>
              Nothing with a deadline yet.
            </p>
          </div>
        ) : (
          <ul>
            {upcoming.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li
                  key={item.id}
                  className="row-hover flex items-center gap-3.5 px-6.5 py-3.5"
                  style={{ borderBottom: "1px solid var(--border-soft)" }}
                >
                  <Icon size={16} style={{ color: `var(--kind-${item.kind})`, flexShrink: 0 }} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/items/${item.id}/edit`}
                      className="truncate text-[14px] font-medium hover:underline"
                      style={{ color: "var(--ink)" }}
                    >
                      {item.title}
                    </Link>
                    <span className="ml-2 text-[11px]" style={{ color: "var(--ink-faint)" }}>
                      {KIND_CONFIG[item.kind].label}
                    </span>
                  </div>
                  <div className="shrink-0 text-[13px]">
                    <DeadlineBadge deadline={item.deadline!} today={today} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  KIND_CONFIG,
  KIND_ROUTE,
  deadlineUrgency,
  formatDeadline,
  type Item,
  type Kind,
} from "@/lib/items";
import StatusSelect from "@/components/StatusSelect";
import DeleteButton from "@/components/DeleteButton";
import { KIND_ICON } from "@/components/icons";

const URGENCY_CLASS: Record<string, string> = {
  overdue: "nb-overdue",
  soon: "",
  normal: "",
  none: "",
};

const URGENCY_STYLE: Record<string, React.CSSProperties> = {
  overdue: { color: "var(--overdue)", fontWeight: 700 },
  soon: { color: "var(--due-soon)", fontWeight: 700 },
  normal: { color: "var(--ink-muted)", fontWeight: 500 },
  none: { color: "var(--ink-faintest)", fontWeight: 400 },
};

type Props = {
  kind: Kind;
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function ItemsList({ kind, searchParams }: Props) {
  const config = KIND_CONFIG[kind];
  const route = KIND_ROUTE[kind];
  const Icon = KIND_ICON[kind];

  const view = searchParams.view === "archive" ? "archive" : "active";
  const rawStatus = searchParams.status;
  const statusFilter =
    typeof rawStatus === "string" && config.statuses.includes(rawStatus)
      ? rawStatus
      : null;
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  const supabase = await createClient();

  const visibleStatuses = view === "archive" ? config.archiveStatuses : config.activeStatuses;
  const statusesToQuery = statusFilter ? [statusFilter] : visibleStatuses;

  let query = supabase
    .from("items")
    .select("*")
    .eq("kind", kind)
    .in("status", statusesToQuery)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (q) {
    query = query.or(`title.ilike.%${q}%,notes.ilike.%${q}%`);
  }

  const [{ data: items, error }, { count: activeCount }, { count: archiveCount }] =
    await Promise.all([
      query.returns<Item[]>(),
      supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("kind", kind)
        .in("status", config.activeStatuses),
      supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("kind", kind)
        .in("status", config.archiveStatuses),
    ]);

  const isFiltered = Boolean(q || statusFilter);

  return (
    <div className="mx-auto w-full max-w-4xl px-7 py-8">
      <div
        className="rounded"
        style={{ background: "var(--paper)", border: "1px solid var(--border)", overflow: "hidden" }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-6.5 py-4.5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div className="flex items-center gap-3">
            <Icon size={19} style={{ color: `var(--kind-${kind})` }} />
            <div className="tab-pill-group">
              <Link href={`${route}?view=active`} className={`tab-pill ${view === "active" ? "active" : ""}`}>
                Active · {activeCount ?? 0}
              </Link>
              <Link href={`${route}?view=archive`} className={`tab-pill ${view === "archive" ? "active" : ""}`}>
                Archive · {archiveCount ?? 0}
              </Link>
            </div>
          </div>
          <Link href={`${route}/new`} className="pill-btn-primary text-[13px]">
            + Add {config.label.toLowerCase()}
          </Link>
        </div>

        <form
          className="flex flex-wrap gap-2.5 px-6.5 py-3.5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
          method="get"
        >
          <input type="hidden" name="view" value={view} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search titles, tags, notes…"
            className="min-w-[180px] flex-1 rounded-full px-4 py-2 text-[13px]"
            style={{ background: "var(--panel)", border: "1px solid var(--input-border)", color: "var(--ink)" }}
          />
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="rounded-full px-4 py-2 text-[13px]"
            style={{ background: "var(--panel)", border: "1px solid var(--input-border)", color: "var(--ink)" }}
          >
            <option value="">All statuses</option>
            {visibleStatuses.map((s) => (
              <option key={s} value={s}>
                {config.statusLabels[s]}
              </option>
            ))}
          </select>
          <button type="submit" className="pill-btn-secondary text-[13px]">
            Filter
          </button>
        </form>

        {error && (
          <div className="m-6.5 rounded p-5" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              Couldn&apos;t load {config.pluralLabel.toLowerCase()}: {error.message}
            </p>
          </div>
        )}

        {!error && items && items.length === 0 && !isFiltered && (
          <div className="px-7 py-16 text-center">
            <Icon size={34} style={{ color: `var(--kind-${kind})`, opacity: 0.35, margin: "0 auto 18px" }} />
            <h2 className="font-serif mb-4 text-[26px]" style={{ color: "var(--ink)" }}>
              A blank page, on purpose.
            </h2>
            <p className="mx-auto mb-8 max-w-sm text-[15px] leading-loose" style={{ color: "var(--ink-muted)" }}>
              Drop in the first {config.label.toLowerCase()} you&apos;re circling. You
              can add the deadline once you&apos;ve read the page properly.
            </p>
            <Link href={`${route}/new`} className="pill-btn-primary inline-block text-[15px]">
              + Add your first {config.label.toLowerCase()}
            </Link>
          </div>
        )}

        {!error && items && items.length === 0 && isFiltered && (
          <div className="px-7 py-16 text-center">
            <h2 className="font-serif mb-3 text-[20px]" style={{ color: "var(--ink)" }}>
              Nothing matches that combination.
            </h2>
            <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              Try dropping the status filter or clearing your search.
            </p>
            <Link href={route} className="pill-btn-secondary inline-block text-[13px]">
              Clear all filters
            </Link>
          </div>
        )}

        {items && items.length > 0 && (
          <ul>
            {items.map((item) => {
              const urgency = deadlineUrgency(item.deadline);
              return (
                <li
                  key={item.id}
                  className="row-hover grid grid-cols-[1fr_auto_auto_auto] items-center gap-4.5 px-6.5 py-4.5"
                  style={{ borderBottom: "1px solid var(--border-soft)" }}
                >
                  <div className="min-w-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-serif block truncate text-[19px] font-semibold hover:underline"
                      style={{ color: "var(--ink)" }}
                    >
                      {item.title}
                    </a>
                    {item.notes && (
                      <div
                        className="font-serif mt-1 truncate text-[13px] italic"
                        style={{ color: "var(--ink-muted)" }}
                      >
                        {item.notes}
                      </div>
                    )}
                    {item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                          <span key={tag} className="tag-chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <StatusSelect id={item.id} kind={kind} status={item.status} />

                  <div className="w-[110px] text-right">
                    {item.deadline ? (
                      <>
                        <div className={URGENCY_CLASS[urgency]} style={{ ...URGENCY_STYLE[urgency], fontSize: 13 }}>
                          {formatDeadline(item.deadline, urgency)}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: "var(--ink-faintest)" }}>
                          {item.deadline}
                        </div>
                      </>
                    ) : (
                      <span className="text-[13px]" style={{ color: "var(--ink-faintest)" }}>
                        No deadline
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link href={`/items/${item.id}/edit`} className="row-action">
                      Edit
                    </Link>
                    <DeleteButton id={item.id} title={item.title} />
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

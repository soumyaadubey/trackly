import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ITEMS_PER_PAGE,
  KIND_CONFIG,
  KIND_ROUTE,
  MAX_TAG_LENGTH,
  type Item,
  type Kind,
} from "@/lib/items";
import { reportError } from "@/lib/errors";
import StatusSelect from "@/components/StatusSelect";
import DeleteButton from "@/components/DeleteButton";
import DeadlineBadge from "@/components/DeadlineBadge";
import { getViewerToday } from "@/lib/viewer-date";
import { KIND_ICON } from "@/components/icons";

type Props = {
  kind: Kind;
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function ItemsList({ kind, searchParams }: Props) {
  const config = KIND_CONFIG[kind];
  const route = KIND_ROUTE[kind];
  const Icon = KIND_ICON[kind];

  const view = searchParams.view === "archive" ? "archive" : "active";
  const visibleStatuses = view === "archive" ? config.archiveStatuses : config.activeStatuses;

  // Validate the status against the statuses this *view* shows, not against
  // every status the kind has. Checking the full set meant ?view=active&
  // status=rejected rendered archived rows under a highlighted "Active" tab,
  // with the dropdown showing "All statuses" because it had no such option.
  const rawStatus = searchParams.status;
  const statusFilter =
    typeof rawStatus === "string" && visibleStatuses.includes(rawStatus)
      ? rawStatus
      : null;

  const q = typeof searchParams.q === "string" ? searchParams.q.trim().slice(0, 200) : "";
  const tagFilter =
    typeof searchParams.tag === "string" && searchParams.tag.trim()
      ? searchParams.tag.trim().slice(0, MAX_TAG_LENGTH)
      : null;
  const rawPage = typeof searchParams.page === "string" ? parseInt(searchParams.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const supabase = await createClient();

  // The viewer's own calendar date, so deadline labels are correct in the
  // initial HTML rather than being corrected after hydration.
  const today = await getViewerToday();

  const statusesToQuery = statusFilter ? [statusFilter] : visibleStatuses;

  let query = supabase
    .from("items")
    .select("*", { count: "exact" })
    .eq("kind", kind)
    .in("status", statusesToQuery)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (q) {
    // search_text is a generated column (title + notes + tags) with a trigram
    // index behind it, so this is one indexed predicate rather than the three
    // ORed sequential scans it replaced — and it finally searches tags, which
    // the placeholder had always claimed it did.
    //
    // The value is still quoted so commas/parens/colons in the search text
    // aren't parsed as PostgREST filter syntax. Backslashes and quotes inside
    // must be escaped since the quoted value uses backslash-escaping itself.
    // % and _ are escaped too, so a literal % doesn't become a LIKE wildcard.
    const escaped = q
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/[%_]/g, (c) => `\\${c}`);
    query = query.ilike("search_text", `%${escaped}%`);
  }

  if (tagFilter) {
    query = query.contains("tags", [tagFilter]);
  }

  query = query.range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

  const [
    { data: items, error, count: totalCount },
    { count: activeCount },
    { count: archiveCount },
  ] = await Promise.all([
    query.returns<Item[]>(),
    // These two must be "exact". A "planned" count returns the query planner's
    // estimate from pg_class.reltuples, which on a table of this size is not
    // an approximation of the answer — it is unrelated to it, and reports
    // things like "1" for a tab holding a dozen rows. The estimate only starts
    // resembling reality on tables large enough for ANALYZE to have meaningful
    // statistics, which is also the only point at which an exact count costs
    // enough to be worth trading away. Revisit at ~100k rows per user, not before.
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

  if (error) {
    reportError("ItemsList.query", error);
  }

  const isFiltered = Boolean(q || statusFilter || tagFilter);
  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / ITEMS_PER_PAGE));
  const outOfRange = (totalCount ?? 0) > 0 && (items?.length ?? 0) === 0;

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    params.set("view", view);
    if (statusFilter) params.set("status", statusFilter);
    if (q) params.set("q", q);
    if (tagFilter) params.set("tag", tagFilter);
    if (targetPage > 1) params.set("page", String(targetPage));
    return `${route}?${params.toString()}`;
  }

  function tagHref(tag: string) {
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("tag", tag);
    return `${route}?${params.toString()}`;
  }

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
          className="flex flex-wrap items-center gap-2.5 px-6.5 py-3.5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
          method="get"
          role="search"
          aria-label={`Filter ${config.pluralLabel.toLowerCase()}`}
        >
          <input type="hidden" name="view" value={view} />
          {tagFilter && <input type="hidden" name="tag" value={tagFilter} />}

          <label htmlFor="items-search" className="sr-only">
            Search {config.pluralLabel.toLowerCase()}
          </label>
          <input
            id="items-search"
            type="search"
            name="q"
            defaultValue={q}
            maxLength={200}
            placeholder="Search titles, tags, notes…"
            className="min-w-[180px] flex-1 rounded-full px-4 py-2 text-[13px]"
            style={{ background: "var(--panel)", border: "1px solid var(--input-border)", color: "var(--ink)" }}
          />

          <label htmlFor="items-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="items-status"
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

          {tagFilter && (
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>
              Tagged
              <span className="tag-chip">{tagFilter}</span>
              <Link
                href={`${route}?view=${view}`}
                className="row-action"
                aria-label={`Clear the ${tagFilter} tag filter`}
              >
                Clear
              </Link>
            </span>
          )}
        </form>

        {error && (
          <div className="m-6.5 rounded p-5" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              Couldn&apos;t load {config.pluralLabel.toLowerCase()} just now.
              Everything you&apos;ve saved is still there — try reloading.
            </p>
          </div>
        )}

        {!error && items && items.length === 0 && outOfRange && (
          <div className="px-7 py-16 text-center">
            <h2 className="font-serif mb-3 text-[20px]" style={{ color: "var(--ink)" }}>
              Nothing on page {page}.
            </h2>
            <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              Only {totalPages} page{totalPages === 1 ? "" : "s"} match right now.
            </p>
            <Link href={pageHref(1)} className="pill-btn-secondary inline-block text-[13px]">
              Back to page 1
            </Link>
          </div>
        )}

        {!error && items && items.length === 0 && !outOfRange && !isFiltered && (
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

        {!error && items && items.length === 0 && !outOfRange && isFiltered && (
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
              return (
                <li
                  key={item.id}
                  className="row-hover flex flex-col gap-3 px-6.5 py-4.5 sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4.5"
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
                        {/* Tags were stored, rendered, and otherwise inert.
                            Clicking one now filters the list by it. */}
                        {item.tags.map((tag) => (
                          <Link
                            key={tag}
                            href={tagHref(tag)}
                            className="tag-chip tag-chip-link"
                            aria-label={`Show only items tagged ${tag}`}
                          >
                            {tag}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 sm:contents">
                    <StatusSelect id={item.id} kind={kind} status={item.status} />

                    <div className="sm:w-[110px] sm:text-right">
                      {item.deadline ? (
                        <DeadlineBadge deadline={item.deadline} today={today} showDate />
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
                      <DeleteButton item={item} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {items && items.length > 0 && totalPages > 1 && (
          <div
            className="flex items-center justify-between px-6.5 py-3.5"
            style={{ borderTop: "1px solid var(--border-soft)" }}
          >
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="pill-btn-secondary text-[13px]">
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="pill-btn-secondary text-[13px]">
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const KINDS = ["opportunity", "course", "roadmap"] as const;
export type Kind = (typeof KINDS)[number];

type KindConfig = {
  label: string;
  pluralLabel: string;
  statuses: string[];
  activeStatuses: string[];
  // Statuses where the deadline is still something to act on. Narrower than
  // activeStatuses for opportunities: once applied, the application deadline
  // no longer matters even though the opportunity is still live.
  deadlineStatuses: string[];
  archiveStatuses: string[];
  statusLabels: Record<string, string>;
  statusBadge: Record<string, string>;
};

export const KIND_CONFIG: Record<Kind, KindConfig> = {
  opportunity: {
    label: "Opportunity",
    pluralLabel: "Opportunities",
    statuses: ["saved", "applying", "applied", "interview", "accepted", "rejected", "ghosted"],
    activeStatuses: ["saved", "applying", "applied", "interview"],
    deadlineStatuses: ["saved", "applying"],
    archiveStatuses: ["accepted", "rejected", "ghosted"],
    statusLabels: {
      saved: "Saved",
      applying: "Applying",
      applied: "Applied",
      interview: "Interview",
      accepted: "Accepted",
      rejected: "Rejected",
      ghosted: "Ghosted",
    },
    statusBadge: {
      saved: "badge-neutral",
      applying: "badge-applying",
      applied: "badge-applied",
      interview: "badge-interview",
      accepted: "badge-applied",
      rejected: "badge-danger",
      ghosted: "badge-neutral",
    },
  },
  course: {
    label: "Course",
    pluralLabel: "Courses",
    statuses: ["saved", "in_progress", "completed", "abandoned"],
    activeStatuses: ["saved", "in_progress"],
    deadlineStatuses: ["saved", "in_progress"],
    archiveStatuses: ["completed", "abandoned"],
    statusLabels: {
      saved: "Saved",
      in_progress: "In progress",
      completed: "Completed",
      abandoned: "Abandoned",
    },
    statusBadge: {
      saved: "badge-neutral",
      in_progress: "badge-applying",
      completed: "badge-applied",
      abandoned: "badge-danger",
    },
  },
  roadmap: {
    label: "Roadmap",
    pluralLabel: "Roadmaps",
    statuses: ["saved", "in_progress", "completed"],
    activeStatuses: ["saved", "in_progress"],
    deadlineStatuses: ["saved", "in_progress"],
    archiveStatuses: ["completed"],
    statusLabels: {
      saved: "Saved",
      in_progress: "In progress",
      completed: "Completed",
    },
    statusBadge: {
      saved: "badge-neutral",
      in_progress: "badge-applying",
      completed: "badge-applied",
    },
  },
};

export const ITEMS_PER_PAGE = 25;

/**
 * Field limits. These mirror the CHECK constraints in supabase/schema.sql —
 * the database is the real boundary, these exist so the user finds out while
 * typing rather than after a failed round-trip. Change them in both places.
 */
export const MAX_TITLE_LENGTH = 300;
export const MAX_URL_LENGTH = 2048;
export const MAX_NOTES_LENGTH = 10000;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 50;

export const KIND_ROUTE: Record<Kind, string> = {
  opportunity: "/opportunities",
  course: "/courses",
  roadmap: "/roadmaps",
};

/**
 * A PostgREST `or` filter matching items whose deadline still needs acting
 * on, checked per kind. A flat `status in (...)` over the union of statuses
 * would also match any status shared between kinds, and the dashboard shows
 * counts from this filter, so it has to be exact.
 */
export function deadlineStatusFilter(): string {
  return KINDS.map(
    (kind) => `and(kind.eq.${kind},status.in.(${KIND_CONFIG[kind].deadlineStatuses.join(",")}))`,
  ).join(",");
}

/**
 * Whether an item's deadline is still something to act on. Once an
 * opportunity is applied to (or anything is finished), its deadline is just a
 * date: it must not be shown as overdue or due soon.
 */
export function deadlineIsActionable(kind: Kind, status: string): boolean {
  return KIND_CONFIG[kind].deadlineStatuses.includes(status);
}

/**
 * PostgREST `or` filter: items still live for their kind (its active
 * statuses). A next step counts while the item is live, even after the
 * application deadline stopped mattering.
 */
export function activeStatusFilter(): string {
  return KINDS.map(
    (kind) => `and(kind.eq.${kind},status.in.(${KIND_CONFIG[kind].activeStatuses.join(",")}))`,
  ).join(",");
}

export function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

export type Item = {
  id: string;
  user_id: string;
  kind: Kind;
  title: string;
  url: string;
  status: string;
  tags: string[];
  deadline: string | null;
  notes: string | null;
  /** What happens next once applied (an interview, a result date), with its date. Both or neither. */
  next_step: NextStep | null;
  next_step_date: string | null;
  created_at: string;
  updated_at: string;
};

export const NEXT_STEPS = ["interview", "follow_up", "result", "other"] as const;
export type NextStep = (typeof NEXT_STEPS)[number];
export const NEXT_STEP_LABELS: Record<NextStep, string> = {
  interview: "Interview",
  follow_up: "Follow-up",
  result: "Result",
  other: "Next step",
};

export function isNextStep(value: unknown): value is NextStep {
  return typeof value === "string" && (NEXT_STEPS as readonly string[]).includes(value);
}

export function isStatusForKind(kind: Kind, value: string): boolean {
  return KIND_CONFIG[kind].statuses.includes(value);
}

export type RestorableItem = Omit<Item, "user_id">;

export function parseTags(raw: FormDataEntryValue | null): string[] {
  const seen = new Set<string>();
  return String(raw ?? "")
    .split(",")
    .map((t) => t.trim().slice(0, MAX_TAG_LENGTH))
    .filter((t) => {
      if (!t || seen.has(t)) return false;
      seen.add(t);
      return true;
    })
    .slice(0, MAX_TAGS);
}

export type ItemFields = {
  title: string;
  url: string;
  status: string;
  deadline: string | null;
  notes: string | null;
  tags: string[];
  next_step: NextStep | null;
  next_step_date: string | null;
};

/**
 * Read an item out of a submitted form and validate it.
 *
 * createItem and updateItem used to carry identical copies of this block, so a
 * rule added to one could silently miss the other.
 */
export function parseItemForm(
  formData: FormData,
  kind: Kind,
): { ok: true; fields: ItemFields } | { ok: false; error: string } {
  const title = String(formData.get("title") ?? "").trim();
  const rawUrl = String(formData.get("url") ?? "").trim();
  const status = String(formData.get("status") ?? "saved");
  const deadline = String(formData.get("deadline") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const tags = parseTags(formData.get("tags"));
  const rawStep = String(formData.get("next_step") ?? "").trim();
  const nextStepDate = String(formData.get("next_step_date") ?? "").trim() || null;

  if (!title || !rawUrl) {
    return { ok: false, error: "Title and URL are required." };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Title must be under ${MAX_TITLE_LENGTH} characters.` };
  }
  // Checked on the prefixed form: that is what gets stored.
  const url = parseHttpUrl(rawUrl);
  if (url && url.length > MAX_URL_LENGTH) {
    return { ok: false, error: "That link is too long." };
  }
  if (!url) {
    return { ok: false, error: "That doesn't look like a web link. Check it starts like example.com or https://…" };
  }
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return { ok: false, error: `Notes must be under ${MAX_NOTES_LENGTH} characters.` };
  }
  if (!isStatusForKind(kind, status)) {
    return { ok: false, error: "Invalid status." };
  }
  if (deadline !== null && !isValidDate(deadline)) {
    return { ok: false, error: "That deadline isn't a valid date." };
  }
  // A next step is a type and a date together; the database enforces the pair.
  if (rawStep && !isNextStep(rawStep)) {
    return { ok: false, error: "Invalid next step." };
  }
  const nextStep = rawStep ? (rawStep as NextStep) : null;
  if ((nextStep === null) !== (nextStepDate === null)) {
    return { ok: false, error: "Give the next step both a type and a date, or leave both empty." };
  }
  if (nextStepDate !== null && !isValidDate(nextStepDate)) {
    return { ok: false, error: "That next-step date isn't a valid date." };
  }

  return {
    ok: true,
    fields: { title, url, status, deadline, notes, tags, next_step: nextStep, next_step_date: nextStepDate },
  };
}

/** A `<input type="date">` value: YYYY-MM-DD, and a date that actually exists. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

/**
 * The one rule for what counts as a link, shared by the form, the server
 * actions and rendering. Returns the link as it should be stored (with
 * https:// added when no scheme was typed), or null.
 *
 * Only http(s) links to a real-looking host are accepted: a dot and a TLD, or
 * localhost. Embedded credentials are rejected. The text is otherwise kept as
 * typed rather than re-serialised, so nothing the user wrote gets rewritten.
 */
export function parseHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  const host = parsed.hostname;
  if (host !== "localhost" && !/\.(?:[a-z]{2,}|xn--[a-z0-9-]+)$/i.test(host)) return null;
  return candidate;
}

export type Urgency = "overdue" | "soon" | "normal" | "none";

/**
 * Whole days from `from` to `to`. Both are YYYY-MM-DD calendar dates.
 *
 * Anchored to UTC midnight purely as a counting device — no timezone is being
 * asserted here. Doing the arithmetic on local Date objects (the previous
 * approach) breaks across a DST boundary, where two consecutive calendar days
 * are 23 or 25 hours apart and a millisecond division rounds to the wrong day.
 */
export function daysBetweenDates(from: string, to: string): number {
  const utcDay = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return utcDay(to) - utcDay(from);
}

/**
 * The calendar date `days` after `date`. Negative values go backwards.
 *
 * UTC-anchored for the same reason as `daysBetweenDates`: adding 86_400_000ms
 * to a local Date lands on the wrong day twice a year. `Date.UTC` normalises
 * an out-of-range day, so month and year boundaries need no special casing.
 */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The calendar date at a given offset (minutes ahead of UTC) right now. */
export function todayForOffset(offsetMinutes: number, now: number = Date.now()): string {
  return new Date(now + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** The calendar date in the runtime's own local timezone. */
export function localToday(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * How urgent a deadline is, relative to a caller-supplied "today".
 *
 * `today` is a parameter rather than being read from the clock so that the
 * server and the client can be given the same reference date and agree on the
 * answer. When this read `new Date()` internally, the server (UTC) and the
 * viewer could not agree, so the component rendered a raw ISO date and swapped
 * it after hydration — a visible reflow on every row of every page.
 */
export function deadlineUrgency(deadline: string | null, today: string): Urgency {
  if (!deadline) return "none";
  const diffDays = daysBetweenDates(today, deadline);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "soon";
  return "normal";
}

export function formatDeadline(deadline: string, urgency: Urgency, today: string): string {
  const diffDays = daysBetweenDates(today, deadline);

  if (urgency === "overdue") {
    const daysAgo = Math.abs(diffDays);
    return `${daysAgo} day${daysAgo === 1 ? "" : "s"} overdue`;
  }
  if (urgency === "soon") {
    if (diffDays === 0) return "Due today";
    return `In ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  }

  // Formatted in UTC against a UTC-parsed date, so the output does not depend
  // on the runtime's timezone — server and client produce the same string.
  return new Date(`${deadline}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

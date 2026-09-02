export const KINDS = ["opportunity", "course", "roadmap"] as const;
export type Kind = (typeof KINDS)[number];

type KindConfig = {
  label: string;
  pluralLabel: string;
  statuses: string[];
  activeStatuses: string[];
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
  created_at: string;
  updated_at: string;
};

export function isStatusForKind(kind: Kind, value: string): boolean {
  return KIND_CONFIG[kind].statuses.includes(value);
}

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
  const url = normalizeUrl(String(formData.get("url") ?? ""));
  const status = String(formData.get("status") ?? "saved");
  const deadline = String(formData.get("deadline") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const tags = parseTags(formData.get("tags"));

  if (!title || !url) {
    return { ok: false, error: "Title and URL are required." };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Title must be under ${MAX_TITLE_LENGTH} characters.` };
  }
  if (url.length > MAX_URL_LENGTH) {
    return { ok: false, error: "That link is too long." };
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

  return { ok: true, fields: { title, url, status, deadline, notes, tags } };
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

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
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

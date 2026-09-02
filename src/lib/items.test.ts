import { describe, expect, it } from "vitest";
import {
  deadlineUrgency,
  formatDeadline,
  isKind,
  isStatusForKind,
  daysBetweenDates,
  isValidDate,
  localToday,
  todayForOffset,
  normalizeUrl,
  parseItemForm,
  parseTags,
  MAX_TAGS,
  MAX_TAG_LENGTH,
} from "./items";

/**
 * A fixed reference date. The urgency and formatting functions now take
 * "today" as an argument instead of reading the clock, so most of these tests
 * no longer need the real date at all — which is what makes them independent
 * of both the timezone and the moment the suite happens to run.
 */
const TODAY = "2026-03-10";

/** `days` after `from`, as YYYY-MM-DD. Pure string arithmetic, UTC-anchored. */
function daysFrom(from: string, days: number): string {
  const [y, m, d] = from.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

describe("deadlineUrgency", () => {
  it("returns 'none' when there is no deadline", () => {
    expect(deadlineUrgency(null, TODAY)).toBe("none");
  });

  it("returns 'overdue' for a date in the past", () => {
    expect(deadlineUrgency(daysFrom(TODAY, -1), TODAY)).toBe("overdue");
  });

  it("returns 'soon' for today through 7 days out", () => {
    expect(deadlineUrgency(daysFrom(TODAY, 0), TODAY)).toBe("soon");
    expect(deadlineUrgency(daysFrom(TODAY, 7), TODAY)).toBe("soon");
  });

  it("returns 'normal' beyond 7 days out", () => {
    expect(deadlineUrgency(daysFrom(TODAY, 8), TODAY)).toBe("normal");
  });
});

describe("formatDeadline", () => {
  it("pluralizes 'day' correctly for overdue items", () => {
    expect(formatDeadline(daysFrom(TODAY, -1), "overdue", TODAY)).toBe("1 day overdue");
    expect(formatDeadline(daysFrom(TODAY, -3), "overdue", TODAY)).toBe("3 days overdue");
  });

  it("says 'Due today' for a same-day soon deadline", () => {
    expect(formatDeadline(daysFrom(TODAY, 0), "soon", TODAY)).toBe("Due today");
  });

  it("counts remaining days for a soon deadline", () => {
    expect(formatDeadline(daysFrom(TODAY, 3), "soon", TODAY)).toBe("In 3 days");
  });

  it("falls back to a formatted date for normal urgency", () => {
    const result = formatDeadline(daysFrom(TODAY, 30), "normal", TODAY);
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });
});

describe("isKind / isStatusForKind", () => {
  it("recognizes valid kinds only", () => {
    expect(isKind("opportunity")).toBe(true);
    expect(isKind("course")).toBe(true);
    expect(isKind("roadmap")).toBe(true);
    expect(isKind("bogus")).toBe(false);
  });

  it("validates status against the right kind's status set", () => {
    expect(isStatusForKind("opportunity", "interview")).toBe(true);
    expect(isStatusForKind("course", "interview")).toBe(false);
    expect(isStatusForKind("roadmap", "completed")).toBe(true);
  });
});

describe("parseTags", () => {
  it("splits, trims, and drops empty tags", () => {
    expect(parseTags(" ai ,  ml,, backend ")).toEqual(["ai", "ml", "backend"]);
  });

  it("returns an empty array for null/empty input", () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("normalizeUrl", () => {
  it("leaves an already-schemed url untouched", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("prepends https:// to a bare domain", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUrl("  example.com  ")).toBe("https://example.com");
  });

  it("passes through an empty string", () => {
    expect(normalizeUrl("   ")).toBe("");
  });
});

describe("deadlineUrgency (explicit boundaries)", () => {
  // Both dates are supplied, so these pin down exactly where each boundary
  // sits without depending on the clock or the runtime timezone at all.
  function at(today: string, deadline: string) {
    return deadlineUrgency(deadline, today);
  }

  it("treats the day itself as 'soon', not 'overdue'", () => {
    expect(at("2026-03-10", "2026-03-10")).toBe("soon");
  });

  it("puts the overdue boundary at the previous day", () => {
    expect(at("2026-03-10", "2026-03-09")).toBe("overdue");
  });

  it("puts the soon/normal boundary at exactly 7 days", () => {
    expect(at("2026-03-10", "2026-03-17")).toBe("soon");
    expect(at("2026-03-10", "2026-03-18")).toBe("normal");
  });

  it("handles a month boundary", () => {
    expect(at("2026-01-31", "2026-02-01")).toBe("soon");
  });

  it("handles a leap day", () => {
    expect(at("2028-02-28", "2028-02-29")).toBe("soon");
  });
});

describe("parseTags", () => {
  it("drops duplicates", () => {
    expect(parseTags("ai, ai, ml")).toEqual(["ai", "ml"]);
  });

  it("caps the number of tags", () => {
    const many = Array.from({ length: MAX_TAGS + 10 }, (_, i) => `t${i}`).join(",");
    expect(parseTags(many)).toHaveLength(MAX_TAGS);
  });

  it("truncates an over-long tag rather than rejecting the whole input", () => {
    const long = "x".repeat(MAX_TAG_LENGTH + 25);
    expect(parseTags(long)[0]).toHaveLength(MAX_TAG_LENGTH);
  });
});

describe("isValidDate", () => {
  it("accepts a real date", () => {
    expect(isValidDate("2026-03-10")).toBe(true);
  });

  it("rejects a malformed string", () => {
    expect(isValidDate("10-03-2026")).toBe(false);
    expect(isValidDate("2026-3-10")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });

  it("rejects a date that does not exist", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2027-02-29")).toBe(false);
  });

  it("accepts a leap day in a leap year", () => {
    expect(isValidDate("2028-02-29")).toBe(true);
  });
});

describe("parseItemForm", () => {
  function form(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  const valid = {
    title: "Hack the North",
    url: "hackthenorth.com",
    status: "applying",
    deadline: "2026-09-30",
    notes: "referred by a friend",
    tags: "hackathon, canada",
  };

  it("parses and normalizes a valid submission", () => {
    const result = parseItemForm(form(valid), "opportunity");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.url).toBe("https://hackthenorth.com");
    expect(result.fields.tags).toEqual(["hackathon", "canada"]);
    expect(result.fields.deadline).toBe("2026-09-30");
  });

  it("requires a title and a url", () => {
    expect(parseItemForm(form({ ...valid, title: "  " }), "opportunity").ok).toBe(false);
    expect(parseItemForm(form({ ...valid, url: "" }), "opportunity").ok).toBe(false);
  });

  it("rejects a status that belongs to a different kind", () => {
    // "interview" is an opportunity status; a course must not accept it.
    const result = parseItemForm(form({ ...valid, status: "interview" }), "course");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Invalid status.");
  });

  it("rejects an impossible deadline", () => {
    const result = parseItemForm(form({ ...valid, deadline: "2026-02-30" }), "opportunity");
    expect(result.ok).toBe(false);
  });

  it("treats an empty deadline and empty notes as null, not empty strings", () => {
    const result = parseItemForm(form({ ...valid, deadline: "", notes: "  " }), "opportunity");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.deadline).toBeNull();
    expect(result.fields.notes).toBeNull();
  });

  it("rejects an over-long title", () => {
    const result = parseItemForm(form({ ...valid, title: "x".repeat(301) }), "opportunity");
    expect(result.ok).toBe(false);
  });
});

describe("normalizeUrl (scheme safety)", () => {
  // The rendered list puts item.url straight into an <a href>. Anything that
  // is not http(s) has to come out the other side inert.
  it("defuses a javascript: url instead of passing it through", () => {
    const out = normalizeUrl("javascript:alert(1)");
    expect(out.startsWith("https://")).toBe(true);
    expect(out.startsWith("javascript:")).toBe(false);
  });

  it("defuses a data: url", () => {
    expect(normalizeUrl("data:text/html,<script>").startsWith("https://")).toBe(true);
  });

  it("preserves a path with commas", () => {
    expect(normalizeUrl("example.com/a,b")).toBe("https://example.com/a,b");
  });
});

describe("daysBetweenDates", () => {
  it("counts forward and backward", () => {
    expect(daysBetweenDates("2026-03-10", "2026-03-17")).toBe(7);
    expect(daysBetweenDates("2026-03-10", "2026-03-09")).toBe(-1);
    expect(daysBetweenDates("2026-03-10", "2026-03-10")).toBe(0);
  });

  it("crosses month and year boundaries", () => {
    expect(daysBetweenDates("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetweenDates("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("counts a leap day", () => {
    expect(daysBetweenDates("2028-02-28", "2028-03-01")).toBe(2); // 29th exists
    expect(daysBetweenDates("2027-02-28", "2027-03-01")).toBe(1); // it doesn't
  });

  it("is unaffected by a DST transition", () => {
    // US DST starts 2026-03-08 and ends 2026-11-01. Spanning either boundary
    // gives 23- and 25-hour days; millisecond division across local Date
    // objects rounds those to the wrong day, which is why this is UTC-anchored.
    expect(daysBetweenDates("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetweenDates("2026-10-31", "2026-11-02")).toBe(2);
  });
});

describe("todayForOffset", () => {
  // 2026-03-10T21:00:00Z — already the 11th in Tokyo, still the 10th in UTC
  // and in New York. This is the disagreement the timezone cookie exists for.
  const instant = Date.parse("2026-03-10T21:00:00Z");

  it("gives the local calendar date for an offset", () => {
    expect(todayForOffset(0, instant)).toBe("2026-03-10");       // UTC
    expect(todayForOffset(-300, instant)).toBe("2026-03-10");    // UTC-5
    expect(todayForOffset(330, instant)).toBe("2026-03-11");     // UTC+5:30
    expect(todayForOffset(540, instant)).toBe("2026-03-11");     // UTC+9
  });

  it("is what makes the difference visible in urgency", () => {
    const deadline = "2026-03-11";
    expect(deadlineUrgency(deadline, todayForOffset(0, instant))).toBe("soon");
    expect(formatDeadline(deadline, "soon", todayForOffset(0, instant))).toBe("In 1 day");
    // For the Tokyo viewer the same deadline is already today.
    expect(formatDeadline(deadline, "soon", todayForOffset(540, instant))).toBe("Due today");
  });
});

describe("formatDeadline is runtime-timezone independent", () => {
  // The absolute-date branch must produce identical output on the server and
  // the client, or hydration would swap the text — the flash this replaced.
  it("formats the stored date, not a locally-parsed one", () => {
    expect(formatDeadline("2026-03-11", "normal", "2026-01-01")).toBe("Mar 11");
    expect(formatDeadline("2026-01-01", "normal", "2025-01-01")).toBe("Jan 1");
    expect(formatDeadline("2026-12-31", "normal", "2026-01-01")).toBe("Dec 31");
  });

  it("does not shift the date near midnight UTC", () => {
    // A naive `new Date("2026-03-11T00:00:00")` parses as local time, so a
    // runtime east of UTC would render "Mar 10" here.
    expect(formatDeadline("2026-03-11", "normal", "2026-01-01")).not.toBe("Mar 10");
  });
});

describe("localToday", () => {
  it("reads the local calendar components, not a UTC serialisation", () => {
    // 23:30 local on the 10th. toISOString() on this would give the 11th for
    // anyone behind UTC — the exact bug that was in the old test helper.
    const late = new Date(2026, 2, 10, 23, 30, 0);
    expect(localToday(late)).toBe("2026-03-10");

    const early = new Date(2026, 2, 10, 0, 30, 0);
    expect(localToday(early)).toBe("2026-03-10");
  });
});

describe("server/client agreement (the flash this fixed)", () => {
  // DeadlineBadge renders the server's `today` during SSR, then reads the
  // client's real local date. If those two disagree the text changes after
  // hydration — which is exactly the "2026-09-11 → Sep 11" flash on every row.
  // The cookie carries the client's own UTC offset, so the server should
  // arrive at precisely the date the client would compute for itself.

  it("todayForOffset(clientOffset) equals localToday() for this runtime", () => {
    const clientOffset = -new Date().getTimezoneOffset(); // what the inline script writes
    expect(todayForOffset(clientOffset)).toBe(localToday());
  });

  it("produces identical label and urgency on both sides when the dates agree", () => {
    const serverToday = todayForOffset(-new Date().getTimezoneOffset());
    const clientToday = localToday();

    for (const offsetDays of [-30, -1, 0, 1, 3, 7, 8, 45, 400]) {
      const deadline = daysFrom(serverToday, offsetDays);

      const serverUrgency = deadlineUrgency(deadline, serverToday);
      const clientUrgency = deadlineUrgency(deadline, clientToday);
      expect(clientUrgency).toBe(serverUrgency);

      expect(formatDeadline(deadline, clientUrgency, clientToday)).toBe(
        formatDeadline(deadline, serverUrgency, serverToday),
      );
    }
  });

  it("never renders a raw ISO date — that was the pre-hydration placeholder", () => {
    const today = "2026-03-10";
    for (const offsetDays of [-5, 0, 5, 90]) {
      const deadline = daysFrom(today, offsetDays);
      const label = formatDeadline(deadline, deadlineUrgency(deadline, today), today);
      expect(label).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

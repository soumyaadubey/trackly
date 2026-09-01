import { describe, expect, it } from "vitest";
import {
  deadlineUrgency,
  formatDeadline,
  isKind,
  isStatusForKind,
  normalizeUrl,
  parseTags,
} from "./items";

function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("deadlineUrgency", () => {
  it("returns 'none' when there is no deadline", () => {
    expect(deadlineUrgency(null)).toBe("none");
  });

  it("returns 'overdue' for a date in the past", () => {
    expect(deadlineUrgency(isoDateDaysFromNow(-1))).toBe("overdue");
  });

  it("returns 'soon' for today through 7 days out", () => {
    expect(deadlineUrgency(isoDateDaysFromNow(0))).toBe("soon");
    expect(deadlineUrgency(isoDateDaysFromNow(7))).toBe("soon");
  });

  it("returns 'normal' beyond 7 days out", () => {
    expect(deadlineUrgency(isoDateDaysFromNow(8))).toBe("normal");
  });
});

describe("formatDeadline", () => {
  it("pluralizes 'day' correctly for overdue items", () => {
    expect(formatDeadline(isoDateDaysFromNow(-1), "overdue")).toBe("1 day overdue");
    expect(formatDeadline(isoDateDaysFromNow(-3), "overdue")).toBe("3 days overdue");
  });

  it("says 'Due today' for a same-day soon deadline", () => {
    expect(formatDeadline(isoDateDaysFromNow(0), "soon")).toBe("Due today");
  });

  it("counts remaining days for a soon deadline", () => {
    expect(formatDeadline(isoDateDaysFromNow(3), "soon")).toBe("In 3 days");
  });

  it("falls back to a formatted date for normal urgency", () => {
    const result = formatDeadline(isoDateDaysFromNow(30), "normal");
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

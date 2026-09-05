import { describe, expect, it } from "vitest";
import { buildCalendar, foldLine, icsEscape, icsTimestamp, type IcsItem } from "./ics";

const NOW = new Date("2026-09-04T13:45:00.000Z");

function item(over: Partial<IcsItem> = {}): IcsItem {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    kind: "opportunity",
    title: "MLH Fellowship",
    status: "applied",
    deadline: "2026-09-11",
    url: null,
    notes: null,
    ...over,
  };
}

/** Unfold a calendar back into logical lines, the way a parser would. */
function logicalLines(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
}

describe("icsEscape", () => {
  it("escapes the TEXT delimiters", () => {
    expect(icsEscape("Grant; final round, 2026")).toBe("Grant\\; final round\\, 2026");
    expect(icsEscape("C:\\path")).toBe("C:\\\\path");
  });

  it("turns newlines into the literal escape, never a real break", () => {
    expect(icsEscape("one\ntwo")).toBe("one\\ntwo");
    expect(icsEscape("one\r\ntwo")).toBe("one\\ntwo");
    expect(icsEscape("one\rtwo")).toBe("one\\ntwo");
  });

  it("strips control characters that would break a parser", () => {
    expect(icsEscape("a\u0000b\u0007c\u007f")).toBe("abc");
  });

  it("leaves double quotes alone", () => {
    expect(icsEscape('the "good" one')).toBe('the "good" one');
  });

  it("escapes the backslash before the delimiters, not after", () => {
    // A naive order turns \; into \\; and then into \\\; — two escapes for one
    // character, which parsers read as a literal backslash plus a delimiter.
    expect(icsEscape("a\\;b")).toBe("a\\\\\\;b");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds at 75 octets with a leading space on continuations", () => {
    const folded = foldLine("SUMMARY:" + "a".repeat(200));
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(Buffer.byteLength(parts[0], "utf8")).toBe(75);
    for (const p of parts.slice(1)) {
      expect(p.startsWith(" ")).toBe(true);
      expect(Buffer.byteLength(p, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "a".repeat(200));
  });

  it("never splits a multi-byte character in half", () => {
    // Three bytes each, so a naive 75-byte cut lands mid-character.
    const line = "SUMMARY:" + "日".repeat(60);
    const folded = foldLine(line);
    for (const p of folded.split("\r\n")) {
      expect(p).not.toContain("\ufffd");
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("icsTimestamp", () => {
  it("is UTC basic format with no punctuation", () => {
    expect(icsTimestamp(NOW)).toBe("20260904T134500Z");
  });
});

describe("buildCalendar", () => {
  it("wraps events in a well-formed calendar", () => {
    const lines = logicalLines(buildCalendar([item()], NOW));
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("END:VEVENT");
  });

  it("ends every line with CRLF, including the last", () => {
    const ics = buildCalendar([item()], NOW);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\n").every((l, i, a) => i === a.length - 1 || l.endsWith("\r"))).toBe(true);
  });

  it("makes an all-day event whose end is the day after the deadline", () => {
    // DATE-valued ends are exclusive; using the deadline itself gives a
    // zero-length event that several clients decline to draw.
    const lines = logicalLines(buildCalendar([item({ deadline: "2026-09-11" })], NOW));
    expect(lines).toContain("DTSTART;VALUE=DATE:20260911");
    expect(lines).toContain("DTEND;VALUE=DATE:20260912");
  });

  it("rolls the end date over a month boundary", () => {
    const lines = logicalLines(buildCalendar([item({ deadline: "2026-09-30" })], NOW));
    expect(lines).toContain("DTEND;VALUE=DATE:20261001");
  });

  it("gives each item a stable UID so re-import updates rather than duplicates", () => {
    const a = logicalLines(buildCalendar([item()], NOW));
    const b = logicalLines(buildCalendar([item()], new Date("2027-01-01T00:00:00.000Z")));
    const uid = "UID:11111111-2222-3333-4444-555555555555@trackly";
    expect(a).toContain(uid);
    expect(b).toContain(uid);
  });

  it("carries kind and status into the description", () => {
    const lines = logicalLines(buildCalendar([item({ kind: "course", status: "in_progress" })], NOW));
    expect(lines.some((l) => l.startsWith("DESCRIPTION:Course · In progress"))).toBe(true);
    expect(lines).toContain("CATEGORIES:Course");
  });

  it("includes notes and url when present, and omits URL when not", () => {
    const withUrl = logicalLines(
      buildCalendar([item({ url: "https://mlh.io", notes: "Referred by a friend" })], NOW),
    );
    expect(withUrl).toContain("URL:https://mlh.io");
    expect(withUrl.some((l) => l.includes("Referred by a friend"))).toBe(true);

    expect(logicalLines(buildCalendar([item()], NOW)).some((l) => l.startsWith("URL:"))).toBe(false);
  });

  it("does not let a hostile title break out of its property", () => {
    const lines = logicalLines(
      buildCalendar([item({ title: "Real\r\nDTSTART;VALUE=DATE:19700101\r\nX-EVIL:1" })], NOW),
    );
    // One DTSTART, and it is the one we generated.
    expect(lines.filter((l) => l.startsWith("DTSTART")).length).toBe(1);
    expect(lines).toContain("DTSTART;VALUE=DATE:20260911");
    expect(lines.some((l) => l.startsWith("X-EVIL"))).toBe(false);
  });

  it("marks deadlines as free time, not appointments", () => {
    expect(logicalLines(buildCalendar([item()], NOW))).toContain("TRANSP:TRANSPARENT");
  });

  it("attaches a one-day-out alarm to every event", () => {
    const lines = logicalLines(buildCalendar([item(), item({ id: "other" })], NOW));
    expect(lines.filter((l) => l === "BEGIN:VALARM").length).toBe(2);
    expect(lines.filter((l) => l === "TRIGGER:-P1D").length).toBe(2);
  });

  it("produces a valid empty calendar when nothing has a deadline", () => {
    const lines = logicalLines(buildCalendar([], NOW));
    expect(lines).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Trackly//Deadlines//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Trackly deadlines",
      "END:VCALENDAR",
    ]);
  });
});

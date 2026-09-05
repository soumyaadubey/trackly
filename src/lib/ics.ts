import { addDays, KIND_CONFIG, type Kind } from "@/lib/items";

/**
 * iCalendar (RFC 5545) generation for the deadline export.
 *
 * Kept separate from the route so the format rules — escaping, folding, the
 * exclusive end date — are testable without a request or a database.
 */

export type IcsItem = {
  id: string;
  kind: Kind;
  title: string;
  status: string;
  /** YYYY-MM-DD. Items without one are not events and are filtered out upstream. */
  deadline: string;
  url: string | null;
  notes: string | null;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Escape a value for a TEXT property (RFC 5545 §3.3.11).
 *
 * Backslash, semicolon and comma are delimiters in the grammar, and a literal
 * newline would end the property. A title like `Grant; final round, 2026` is
 * ordinary user input and would otherwise be parsed as three separate values.
 * Double quotes are *not* escaped here — they are only special inside
 * parameter values, and escaping them shows a literal backslash in clients.
 */
export function icsEscape(value: string): string {
  return value
    // Control characters have no representation and break parsers outright.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Fold a content line to 75 octets (RFC 5545 §3.1).
 *
 * The limit counts bytes, not characters, and a continuation line begins with
 * a single space that counts toward its own 75 — so continuations carry 74
 * octets of content. Splitting is done on the encoded bytes and then walked
 * back off any UTF-8 continuation byte, because cutting a multi-byte character
 * in half produces a file some clients refuse to open.
 */
export function foldLine(line: string): string {
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // 0b10xxxxxx marks a continuation byte; back up until we are on a boundary.
    while (end > start + 1 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    parts.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
    limit = 74;
  }

  return parts.join("\r\n ");
}

/** `2026-09-11` → `20260911`, the DATE form used by all-day events. */
function compactDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/** A UTC timestamp in the form DTSTAMP requires: `20260911T134500Z`. */
export function icsTimestamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Build a complete calendar from a user's dated items.
 *
 * Events are all-day. DTEND is the day *after* the deadline because the end of
 * a DATE-valued period is exclusive (RFC 5545 §3.6.1) — using the deadline
 * itself renders a zero-length event that several clients simply do not draw.
 *
 * Each event carries a one-day-out alarm. Trackly has no reminder emails, so
 * for anyone who subscribes, their own calendar becomes the reminder.
 */
export function buildCalendar(items: IcsItem[], now: Date = new Date()): string {
  const stamp = icsTimestamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trackly//Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Trackly deadlines",
  ];

  for (const item of items) {
    const config = KIND_CONFIG[item.kind];
    const statusLabel = config.statusLabels[item.status] ?? item.status;
    const description = [
      `${config.label} · ${statusLabel}`,
      item.notes?.trim() || null,
      item.url || null,
    ]
      .filter(Boolean)
      .join("\n\n");

    lines.push(
      "BEGIN:VEVENT",
      // Stable per item, so re-importing updates the existing event instead of
      // leaving the calendar with a second copy of every deadline.
      `UID:${item.id}@trackly`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(item.deadline)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(item.deadline, 1))}`,
      `SUMMARY:${icsEscape(item.title)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      `CATEGORIES:${icsEscape(config.label)}`,
      // A deadline is not an appointment — it should not make the day look busy.
      "TRANSP:TRANSPARENT",
    );

    if (item.url) {
      lines.push(`URL:${icsEscape(item.url)}`);
    }

    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-P1D",
      `DESCRIPTION:${icsEscape(item.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  // CRLF throughout, and a trailing one: RFC 5545 requires every content line
  // to be terminated, the last included.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

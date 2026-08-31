import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/items";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: items, error } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", user.id)
    .order("kind")
    .order("created_at")
    .returns<Item[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  const csv = [header.join(","), ...rows].join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trackly-export-${date}.csv"`,
    },
  });
}

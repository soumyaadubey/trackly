import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { buildCalendar, type IcsItem } from "@/lib/ics";
import { KIND_CONFIG, type Item } from "@/lib/items";
import { ExportTooLargeError, readExportItems } from "@/lib/export-items";

/**
 * Every live deadline as an .ics file.
 *
 * Trackly has no reminder emails. Rather than build a notification system, this
 * hands the deadlines to the calendar the user already checks — each event
 * carries a one-day-out alarm, so their calendar does the reminding.
 *
 * Only active items are included. A calendar full of rejected applications and
 * finished courses is noise, and "active" here means the same thing it means on
 * the dashboard: the status set that kind counts as still live.
 */
export async function GET() {
  // The proxy already blocks signed-out traffic, but authorization that lives
  // only in middleware is one config change (or one CVE-2025-29927) away from
  // being absent. Every route that reads user data re-checks here.
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await createClient();
  let items: Item[];
  try {
    items = await readExportItems(supabase, user.id, true);
    items.sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? "") || a.id.localeCompare(b.id));
  } catch (error) {
    if (error instanceof ExportTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    const ref = reportError("calendar-export", error);
    return NextResponse.json(
      { error: `Couldn't build the calendar. (ref: ${ref})` },
      { status: 500 },
    );
  }

  const events: IcsItem[] = (items ?? [])
    .filter((item) => KIND_CONFIG[item.kind].activeStatuses.includes(item.status))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      status: item.status,
      deadline: item.deadline!,
      url: item.url,
      notes: item.notes,
    }));

  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buildCalendar(events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="trackly-deadlines-${date}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

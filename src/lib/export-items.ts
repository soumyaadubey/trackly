import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KIND_CONFIG, KINDS, type Item } from "@/lib/items";

const BATCH_SIZE = 200;
// Bound memory before CSV/ICS serialization; return an explicit error above this.
export const MAX_EXPORT_BYTES = 16 * 1024 * 1024;
export class ExportTooLargeError extends Error {}

/** Keyset pagination avoids shifting offsets and accommodates API caps below our batch size.
 * This is not a database snapshot. Detect count changes and fail rather than return
 * a known incomplete download; edits that preserve the count may still span versions.
 */
export async function readExportItems(
  supabase: SupabaseClient,
  userId: string,
  calendar = false,
): Promise<Item[]> {
  const activeStatuses = [...new Set(KINDS.flatMap((kind) => KIND_CONFIG[kind].activeStatuses))];
  const items: Item[] = [];
  let cursor: string | undefined;
  let expectedCount: number | undefined;
  let bytes = 0;

  while (true) {
    let query = supabase.from("items")
      .select("id,user_id,kind,title,url,status,tags,deadline,notes,created_at,updated_at", { count: "exact" })
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);
    if (calendar) query = query.not("deadline", "is", null).in("status", activeStatuses);
    if (cursor) query = query.gt("id", cursor);
    const { data, error, count } = await query.returns<Item[]>();
    if (error) throw error;
    if (!data || count === null) throw new Error("Export query did not return rows and an exact count.");
    expectedCount ??= count;
    if (items.length + count !== expectedCount) {
      throw new Error("Records changed during export. Retry the download.");
    }
    if (data.length === 0) {
      if (items.length !== expectedCount) throw new Error("Export ended before all records were returned.");
      return items;
    }
    for (const item of data) {
      if (cursor && item.id <= cursor) throw new Error("Export cursor did not advance.");
      cursor = item.id;
      bytes += Buffer.byteLength(JSON.stringify(item), "utf8");
      if (bytes > MAX_EXPORT_BYTES) throw new ExportTooLargeError("Export exceeds the 16 MiB data limit.");
      items.push(item);
    }
  }
}

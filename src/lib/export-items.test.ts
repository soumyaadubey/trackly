import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "@/lib/items";
import { readExportItems, ExportTooLargeError } from "./export-items";

function fixture(size: number, cap = 200) {
  const rows: Item[] = Array.from({ length: size }, (_, i) => ({
    id: String(i + 1).padStart(36, "0"), user_id: "owner", kind: "opportunity",
    title: `Item ${i}`, url: "https://example.com", status: "saved", tags: [],
    deadline: "2026-10-01", notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  }));
  let calls = 0;
  let failureAt = 0;
  let changeCountAt = 0;
  const from = vi.fn(() => {
    let cursor = "";
    let calendar = false;
    let owner = "";
    let statuses: string[] = [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((_key: string, value: string) => { owner = value; return query; }),
      order: vi.fn(() => query), limit: vi.fn(() => query),
      gt: vi.fn((_key: string, value: string) => { cursor = value; return query; }),
      not: vi.fn(() => { calendar = true; return query; }),
      in: vi.fn((_key: string, value: string[]) => { statuses = value; return query; }),
      returns: async () => {
        calls++;
        if (calls === failureAt) return { data: null, count: null, error: new Error("database offline") };
        const matching = rows.filter((row) => row.user_id === owner && row.id > cursor &&
          (!calendar || (row.deadline !== null && statuses.includes(row.status))));
        return { data: matching.slice(0, cap), count: matching.length + (calls === changeCountAt ? 1 : 0), error: null };
      },
    };
    return query;
  });
  return { rows, from, client: { from } as unknown as SupabaseClient,
    failAt: (n: number) => { failureAt = n; }, changeCountAt: (n: number) => { changeCountAt = n; } };
}

beforeEach(() => vi.clearAllMocks());
describe("complete exports", () => {
  it.each([0, 200, 1001, 2307])("exports %i rows once, even with a provider cap smaller than the batch", async (size) => {
    const f = fixture(size, 73);
    const rows = await readExportItems(f.client, "owner");
    expect(rows).toEqual(f.rows);
    expect(new Set(rows.map((row) => row.id)).size).toBe(size);
  });
  it("restricts calendar rows and never includes another user's records", async () => {
    const f = fixture(1200);
    f.rows[0].user_id = "other";
    f.rows[1].status = "rejected";
    f.rows[2].deadline = null;
    const rows = await readExportItems(f.client, "owner", true);
    expect(rows).toEqual(f.rows.slice(3));
  });
  it("rejects a later batch failure instead of returning a partial export", async () => {
    const f = fixture(1001);
    f.failAt(3);
    await expect(readExportItems(f.client, "owner")).rejects.toThrow("database offline");
  });
  it("rejects count changes during pagination", async () => {
    const f = fixture(1001);
    f.changeCountAt(2);
    await expect(readExportItems(f.client, "owner")).rejects.toThrow("Records changed");
  });
  it("rejects excessive data explicitly", async () => {
    const f = fixture(1800);
    f.rows.forEach((row) => { row.notes = "x".repeat(10000); });
    await expect(readExportItems(f.client, "owner")).rejects.toBeInstanceOf(ExportTooLargeError);
  });
});

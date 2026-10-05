import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), requireUserClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUserClient: mocks.requireUserClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/errors", () => ({ userMessage: () => "Database error" }));
import { deleteItem, restoreItem } from "./actions";
import type { RestorableItem } from "@/lib/items";

const snapshot: RestorableItem = {
  id: "11111111-1111-4111-8111-111111111111", kind: "course", title: "Updated in another tab",
  url: "https://example.com", status: "in_progress", deadline: null, notes: "Latest notes",
  tags: ["a,b", "日本語"], created_at: "2025-01-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUserClient.mockResolvedValue({ user: { id: "verified-owner" }, supabase: { from: mocks.from } });
});
it("returns the deleted database row and enforces ownership", async () => {
  const query = { delete: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
  query.delete.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: snapshot, error: null });
  mocks.from.mockReturnValue(query);
  expect(await deleteItem(snapshot.id)).toEqual({ error: null, deleted: snapshot });
  expect(query.eq.mock.calls).toEqual([["id", snapshot.id], ["user_id", "verified-owner"]]);
});
it("does not offer undo for a missing or unowned row", async () => {
  const query = { delete: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
  query.delete.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: null, error: null }); mocks.from.mockReturnValue(query);
  expect(await deleteItem(snapshot.id)).toEqual({ error: "That item no longer exists." });
});
it("preserves timestamps and fields while assigning the verified owner", async () => {
  const insert = vi.fn().mockResolvedValue({ error: null }); mocks.from.mockReturnValue({ insert });
  expect(await restoreItem({ ...snapshot, user_id: "attacker" } as RestorableItem)).toEqual({ error: null });
  expect(insert).toHaveBeenCalledWith({ ...snapshot, user_id: "verified-owner" });
});
it("rejects malformed restoration timestamps before writing", async () => {
  expect((await restoreItem({ ...snapshot, created_at: "invalid" })).error).toBeTruthy();
  expect(mocks.from).not.toHaveBeenCalled();
});
it("refuses a non-http link in a restored snapshot but keeps older loose links", async () => {
  expect((await restoreItem({ ...snapshot, url: "javascript:alert(1)" })).error).toBeTruthy();
  expect(mocks.from).not.toHaveBeenCalled();
  const insert = vi.fn().mockResolvedValue({ error: null }); mocks.from.mockReturnValue({ insert });
  expect(await restoreItem({ ...snapshot, url: "https://saved before validation" })).toEqual({ error: null });
});
it("reports a restore conflict without overwriting an existing row", async () => {
  const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } }); mocks.from.mockReturnValue({ insert });
  expect((await restoreItem(snapshot)).error).toBe("Database error");
});

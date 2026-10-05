import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), requireUserClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUserClient: mocks.requireUserClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));
vi.mock("@/lib/errors", () => ({ userMessage: () => "Database error" }));
import { deleteItem, restoreItem, updateItem } from "./actions";
import type { RestorableItem } from "@/lib/items";

const snapshot: RestorableItem = {
  id: "11111111-1111-4111-8111-111111111111", kind: "course", title: "Updated in another tab",
  url: "https://example.com", status: "in_progress", deadline: null, notes: "Latest notes",
  tags: ["a,b", "日本語"], next_step: null, next_step_date: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
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

function editForm(expected?: string) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ title: "Edited", url: "example.com", status: "saved", tags: "", notes: "Mine" })) fd.set(k, v);
  if (expected) fd.set("expected_updated_at", expected);
  return fd;
}
function chain(result: unknown) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "update", "eq"]) q[m] = vi.fn(() => q);
  q.maybeSingle = vi.fn().mockResolvedValue(result);
  return q;
}
it("only saves an edit over the version the form was opened from", async () => {
  const lookup = chain({ data: { kind: "course" }, error: null });
  const write = chain({ data: { id: snapshot.id }, error: null });
  mocks.from.mockReturnValueOnce(lookup).mockReturnValueOnce(write);
  await expect(updateItem(snapshot.id, { error: null }, editForm(snapshot.updated_at))).rejects.toThrow("NEXT_REDIRECT");
  expect(write.eq.mock.calls).toEqual([["id", snapshot.id], ["user_id", "verified-owner"], ["updated_at", snapshot.updated_at]]);
});
it("reports a conflicting edit instead of overwriting it", async () => {
  mocks.from
    .mockReturnValueOnce(chain({ data: { kind: "course" }, error: null }))
    .mockReturnValueOnce(chain({ data: null, error: null }));
  const result = await updateItem(snapshot.id, { error: null }, editForm("2020-01-01T00:00:00+00:00"));
  expect(result.error).toMatch(/changed somewhere else/);
});

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removeAccountData } from "./delete-account";

const id = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const bucket = { list: vi.fn(), remove: vi.fn().mockResolvedValue({ error: null }) };
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  const client = { storage: { from: vi.fn(() => bucket) }, auth: { admin: { deleteUser } } };
  return { bucket, deleteUser, client: client as unknown as SupabaseClient };
}
describe("account storage cleanup", () => {
  it("removes all pages and legacy subfolders before deleting auth", async () => {
    const { bucket, deleteUser, client } = fixture();
    bucket.list.mockImplementation(async (prefix: string, options: { offset: number }) => ({
      error: null,
      data: prefix === id
        ? options.offset === 0
          ? Array.from({ length: 100 }, (_, i) => ({ name: `photo-${i}.png`, id: String(i) }))
          : [{ name: "old", id: null }]
        : [{ name: "avatar.png", id: "legacy" }],
    }));
    await removeAccountData(client, id);
    expect(bucket.remove.mock.calls.flatMap(([paths]) => paths)).toHaveLength(101);
    expect(bucket.remove).toHaveBeenLastCalledWith([`${id}/old/avatar.png`]);
    expect(deleteUser).toHaveBeenCalledWith(id);
    expect(deleteUser.mock.invocationCallOrder[0]).toBeGreaterThan(bucket.remove.mock.invocationCallOrder.at(-1)!);
  });
  it.each(["list", "remove"] as const)("leaves the account when %s fails", async (step) => {
    const { bucket, deleteUser, client } = fixture();
    bucket.list.mockResolvedValue({ data: [{ name: "avatar.png", id: "file" }], error: null });
    bucket[step].mockResolvedValue({ data: null, error: new Error("storage failed") });
    await expect(removeAccountData(client, id)).rejects.toThrow("storage failed");
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("allows retry after photos were removed but account deletion failed", async () => {
    const { bucket, deleteUser, client } = fixture();
    bucket.list.mockResolvedValueOnce({ data: [{ name: "avatar.png", id: "file" }], error: null })
      .mockResolvedValue({ data: [], error: null });
    deleteUser.mockResolvedValueOnce({ error: new Error("temporary outage") });
    await expect(removeAccountData(client, id)).rejects.toThrow("temporary outage");
    await removeAccountData(client, id);
    expect(deleteUser).toHaveBeenCalledTimes(2);
    expect(bucket.remove).toHaveBeenCalledTimes(1);
  });
  it("rejects unexpected paths without deleting anything", async () => {
    const { bucket, deleteUser, client } = fixture();
    bucket.list.mockResolvedValue({ data: [{ name: "../other-user", id: "file" }], error: null });
    await expect(removeAccountData(client, id)).rejects.toThrow("Unexpected avatar path");
    expect(deleteUser).not.toHaveBeenCalled();
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});

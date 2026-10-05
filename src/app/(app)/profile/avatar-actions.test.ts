import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  files: new Set<string>(),
  metadata: {} as Record<string, unknown>,
  fail: { upload: false, metadata: false, cleanup: false },
}));
const UID = "11111111-1111-4111-8111-111111111111";
const url = (name: string) => `https://project.supabase.co/storage/v1/object/public/avatars/${UID}/${name}?v=1`;

const bucket = {
  upload: vi.fn(async (path: string) => {
    if (state.fail.upload) return { error: { message: "upload failed" } };
    state.files.add(path);
    return { error: null };
  }),
  getPublicUrl: (path: string) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${path}` } }),
  list: vi.fn(async (prefix: string) => ({
    data: [...state.files].filter((p) => p.startsWith(`${prefix}/`)).map((p) => ({ name: p.slice(prefix.length + 1) })),
    error: null,
  })),
  remove: vi.fn(async (paths: string[]) => {
    if (state.fail.cleanup && !paths.some((p) => p.includes("avatar-"))) return { error: { message: "cleanup failed" } };
    paths.forEach((p) => state.files.delete(p));
    return { error: null };
  }),
};
const auth = {
  updateUser: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (state.fail.metadata) return { error: { message: "metadata failed" } };
    state.metadata = data;
    return { error: null };
  }),
  getUser: vi.fn(async () => ({ data: { user: { id: UID, user_metadata: state.metadata } } })),
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth, storage: { from: () => bucket } }) }));
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ id: UID, user_metadata: state.metadata }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/delete-account", () => ({ removeAccountData: vi.fn() }));
vi.mock("@/lib/errors", () => ({ reportError: vi.fn(() => "ref"), userMessage: () => "Provider error" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { updateAvatar } from "./actions";
import { avatarFileName, nextAvatarName } from "@/lib/avatar";

const upload = (type = "image/jpeg") => {
  const fd = new FormData();
  fd.set("avatar", new File([new Uint8Array(10)], "me", { type }));
  return updateAvatar({ error: null, success: false }, fd);
};

beforeEach(() => {
  vi.clearAllMocks();
  state.files = new Set([`${UID}/avatar.png`]);
  state.metadata = { avatar_url: url("avatar.png"), full_name: "Kept" };
  state.fail = { upload: false, metadata: false, cleanup: false };
});

it("picks the slot the profile is not using", () => {
  expect(nextAvatarName(url("avatar.png"), "jpg")).toBe("avatar-a.jpg");
  expect(nextAvatarName(url("avatar-a.png"), "png")).toBe("avatar-b.png");
  expect(nextAvatarName(url("avatar-b.webp"), "gif")).toBe("avatar-a.gif");
  expect(nextAvatarName(undefined, "png")).toBe("avatar-a.png");
  expect(avatarFileName("https://elsewhere.example/evil.svg")).toBeNull();
});

it("keeps the old photo when the upload fails", async () => {
  state.fail.upload = true;
  expect((await upload()).success).toBe(false);
  expect([...state.files]).toEqual([`${UID}/avatar.png`]);
  expect(state.metadata.avatar_url).toBe(url("avatar.png"));
  expect(bucket.remove).not.toHaveBeenCalled();
});

it("keeps the old photo and removes the new file when the profile update fails", async () => {
  state.fail.metadata = true;
  expect((await upload()).success).toBe(false);
  expect([...state.files]).toEqual([`${UID}/avatar.png`]);
  expect(state.metadata.avatar_url).toBe(url("avatar.png"));
});

it("switches the profile before removing the old photo", async () => {
  expect(await upload()).toEqual({ error: null, success: true });
  expect([...state.files]).toEqual([`${UID}/avatar-a.jpg`]);
  expect(String(state.metadata.avatar_url)).toContain(`${UID}/avatar-a.jpg?v=`);
  expect(state.metadata.full_name).toBe("Kept");
  const updated = auth.updateUser.mock.invocationCallOrder[0];
  expect(bucket.remove.mock.invocationCallOrder.every((n) => n > updated)).toBe(true);

  expect((await upload("image/png")).success).toBe(true);
  expect([...state.files]).toEqual([`${UID}/avatar-b.png`]);
});

it("still succeeds when removing the old photo fails", async () => {
  state.fail.cleanup = true;
  expect((await upload()).success).toBe(true);
  expect(String(state.metadata.avatar_url)).toContain("avatar-a.jpg");
  expect(state.files.has(`${UID}/avatar-a.jpg`)).toBe(true);
});

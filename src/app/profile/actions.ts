"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = { error: string | null; success: boolean };

export type ProfileState = { error: string | null; success: boolean };

export async function updateProfile(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({
    data: { ...user.user_metadata, first_name: firstName, last_name: lastName },
  });

  if (error) return { error: error.message, success: false };

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function updateAvatar(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image first.", success: false };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "That doesn't look like an image file.", success: false };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Keep it under 2MB.", success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}`, success: false };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase.auth.updateUser({
    data: { ...user.user_metadata, avatar_url: `${publicUrl}?v=${Date.now()}` },
  });

  if (error) return { error: error.message, success: false };

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "");

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath("/profile");
  return { error: null, success: true };
}

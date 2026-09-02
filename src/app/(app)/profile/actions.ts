"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { userMessage, reportError } from "@/lib/errors";
import {
  AVATAR_TYPES_LABEL,
  MAX_AVATAR_BYTES,
  extensionForType,
  isAllowedAvatarType,
} from "@/lib/avatar";

export type ChangePasswordState = { error: string | null; success: boolean };
export type ProfileState = { error: string | null; success: boolean };
export type DeleteAccountState = { error: string | null };

const MAX_NAME_LENGTH = 80;
const MIN_PASSWORD_LENGTH = 8;

export async function updateProfile(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();

  if (firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH) {
    return {
      error: `Names need to be under ${MAX_NAME_LENGTH} characters.`,
      success: false,
    };
  }

  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    data: { ...user.user_metadata, first_name: firstName, last_name: lastName },
  });

  if (error) {
    return { error: userMessage("updateProfile", error), success: false };
  }

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

export async function updateAvatar(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image first.", success: false };
  }

  // The browser supplies file.type, so this is a convenience check that gives a
  // clear message — not the security boundary. The bucket's allowed_mime_types
  // and file_size_limit are what actually stop a hand-rolled upload.
  if (!isAllowedAvatarType(file.type)) {
    return {
      error: `That file type isn't supported. Use ${AVATAR_TYPES_LABEL}.`,
      success: false,
    };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Keep it under 2MB.", success: false };
  }

  const user = await requireUser();
  const supabase = await createClient();

  // The extension comes from the validated MIME type, never from the uploaded
  // filename — the storage policy only accepts exactly `<uid>/avatar.<ext>`,
  // so the user has no say in where their file lands or what it is called.
  const ext = extensionForType(file.type);
  const path = `${user.id}/avatar.${ext}`;

  // Switching file types (e.g. .png -> .jpg) would otherwise leave the old
  // extension's file behind in storage forever, since upsert only replaces
  // an exact path match. Clear out any other avatar.* file first.
  const { data: existingFiles } = await supabase.storage.from("avatars").list(user.id);
  const staleFiles = (existingFiles ?? [])
    .filter((f) => f.name !== `avatar.${ext}`)
    .map((f) => `${user.id}/${f.name}`);
  if (staleFiles.length > 0) {
    await supabase.storage.from("avatars").remove(staleFiles);
  }

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: userMessage("updateAvatar.upload", uploadError), success: false };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase.auth.updateUser({
    data: { ...user.user_metadata, avatar_url: `${publicUrl}?v=${Date.now()}` },
  });

  if (error) {
    return { error: userMessage("updateAvatar.metadata", error), success: false };
  }

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

/**
 * Changing a password now requires proving you know the current one.
 *
 * Without that check, a session cookie was the only thing between an attacker
 * and permanent control of the account: a borrowed laptop or a stolen cookie
 * could set a new password, and Supabase's "Secure password change" setting —
 * which would have required reauthentication — is off by default.
 *
 * On success every other session is revoked, so a password change also evicts
 * whoever prompted it.
 */
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get("current_password") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword) {
    return { error: "Enter your current password.", success: false };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      success: false,
    };
  }
  if (password !== confirmPassword) {
    return { error: "The two new passwords don't match.", success: false };
  }
  if (password === currentPassword) {
    return { error: "That's already your password.", success: false };
  }

  const user = await requireUser();
  const supabase = await createClient();

  if (!user.email) {
    return { error: "This account has no email address to verify against.", success: false };
  }

  // Supabase has no dedicated "verify password" endpoint; re-signing in is the
  // supported way to prove possession of the current credential.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (reauthError) {
    reportError("changePassword.reauth", reauthError);
    return { error: "That current password isn't right.", success: false };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: userMessage("changePassword.update", error), success: false };
  }

  // Evict every other session. If the reason for the change was a compromise,
  // leaving the attacker's session alive would defeat the point.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    reportError("changePassword.signOutOthers", signOutError);
  }

  revalidatePath("/profile");
  return { error: null, success: true };
}

/**
 * Self-serve account deletion.
 *
 * The privacy policy promised this and the app did not provide it — the
 * documented route was "open an issue on the project's GitHub repository",
 * which is linked nowhere. Beyond the broken promise, GDPR Article 17 expects
 * a working erasure path.
 *
 * The delete runs through a security-definer function scoped to auth.uid()
 * (see supabase/schema.sql), so the app never needs a service_role key.
 */
export async function deleteAccount(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (confirmation !== "DELETE") {
    return { error: 'Type DELETE exactly to confirm.' };
  }
  if (!password) {
    return { error: "Enter your password to confirm." };
  }

  const user = await requireUser();
  const supabase = await createClient();

  if (!user.email) {
    return { error: "This account has no email address to verify against." };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (reauthError) {
    reportError("deleteAccount.reauth", reauthError);
    return { error: "That password isn't right." };
  }

  const { error } = await supabase.rpc("delete_current_user");

  if (error) {
    return { error: userMessage("deleteAccount", error) };
  }

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

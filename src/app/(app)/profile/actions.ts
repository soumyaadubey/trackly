"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { userMessage, reportError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeAccountData } from "@/lib/delete-account";
import {
  AVATAR_TYPES_LABEL,
  MAX_AVATAR_BYTES,
  avatarFileName,
  extensionForType,
  nextAvatarName,
  isAllowedAvatarType,
} from "@/lib/avatar";

export type ChangePasswordState = { error: string | null; success: boolean; warning?: string };
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
  // filename, and the slot from nextAvatarName — the storage policy only
  // accepts `<uid>/avatar[-a|-b].<ext>`, so the user has no say in where
  // their file lands or what it is called.
  //
  // Order matters: upload into the slot the profile is not using, point the
  // profile at it, and only then remove the old file. Deleting first (as this
  // used to) or overwriting in place meant a failed upload or a failed profile
  // update left the user with no photo at all.
  const bucket = supabase.storage.from("avatars");
  const name = nextAvatarName(user.user_metadata?.avatar_url, extensionForType(file.type));
  const path = `${user.id}/${name}`;

  const { error: uploadError } = await bucket.upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) {
    return { error: userMessage("updateAvatar.upload", uploadError), success: false };
  }

  const {
    data: { publicUrl },
  } = bucket.getPublicUrl(path);

  const { error } = await supabase.auth.updateUser({
    data: { ...user.user_metadata, avatar_url: `${publicUrl}?v=${Date.now()}` },
  });
  if (error) {
    // Nothing points at the new file; the old photo was never touched.
    const { error: undoError } = await bucket.remove([path]);
    if (undoError) reportError("updateAvatar.undoUpload", undoError);
    return { error: userMessage("updateAvatar.metadata", error), success: false };
  }

  // Best effort: the new photo is already saved, so a cleanup failure is only
  // logged and the next replacement tries again. Whatever the profile points
  // at right now is kept too, in case another tab replaced it meanwhile.
  const {
    data: { user: latest },
  } = await supabase.auth.getUser();
  const keep = new Set([name, avatarFileName(latest?.user_metadata?.avatar_url)]);
  const { data: files, error: listError } = await bucket.list(user.id);
  const stale = (files ?? []).filter((f) => !keep.has(f.name)).map((f) => `${user.id}/${f.name}`);
  const { error: cleanupError } = stale.length ? await bucket.remove(stale) : { error: null };
  if (listError || cleanupError) reportError("updateAvatar.cleanup", listError ?? cleanupError);

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
 * Provider current-password enforcement must also be enabled for direct API calls.
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

  // A fresh session also satisfies the provider's secure-password-change window.
  const { data: reauthenticated, error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (reauthError || reauthenticated.user?.id !== user.id) {
    reportError("changePassword.reauth", reauthError);
    return { error: "That current password isn't right.", success: false };
  }

  const { error } = await supabase.auth.updateUser({ password, current_password: currentPassword });

  if (error) {
    return { error: userMessage("changePassword.update", error), success: false };
  }

  // Evict every other session. If the reason for the change was a compromise,
  // leaving the attacker's session alive would defeat the point.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    reportError("changePassword.signOutOthers", signOutError);
    revalidatePath("/profile");
    return { error: null, success: true, warning: "Password updated, but we couldn't confirm sign-out on other devices. Retry below." };
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
 * The server alone holds deletion authority. The old public RPC must be removed
 * by migration 0003 so callers cannot skip fresh password verification.
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

  const { data: reauthenticated, error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (reauthError || reauthenticated.user?.id !== user.id) {
    reportError("deleteAccount.reauth", reauthError);
    return { error: "That password isn't right." };
  }

  const admin = createAdminClient();
  if (!admin) {
    reportError("deleteAccount.configuration", new Error("SUPABASE_SECRET_KEY is not configured"));
    return { error: "Account deletion is temporarily unavailable. Please try again later." };
  }
  try {
    await removeAccountData(admin, user.id);
  } catch (error) {
    const ref = reportError("deleteAccount", error);
    return { error: `Couldn't finish deleting your account. Some profile photos may already be removed; retry to finish. (ref: ${ref})` };
  }

  await supabase.auth.signOut({ scope: "local" });
  redirect("/?deleted=1");
}

export async function signOutOtherSessions(): Promise<ChangePasswordState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: userMessage("signOutOtherSessions", error), success: false };
  return { error: null, success: true };
}

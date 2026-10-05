"use server";

import { createClient } from "@/lib/supabase/server";
import { reportError, userMessage } from "@/lib/errors";
import { getRecoveryUser } from "@/lib/recovery";

export type ResetState = { error: string | null; success?: boolean; warning?: string };

const MIN_PASSWORD_LENGTH = 8;

export async function updatePassword(
  _prevState: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirmPassword) {
    return { error: "The two passwords don't match." };
  }

  const supabase = await createClient();

  if (!(await getRecoveryUser(supabase))) {
    return { error: "Open a fresh password-reset email to continue. Recovery access lasts 15 minutes." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: userMessage("updatePassword", error) };
  }

  // End the recovery session too; sign in again using the new password.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  if (signOutError) {
    reportError("updatePassword.signOutAll", signOutError);
    await supabase.auth.signOut({ scope: "local" });
    return { error: null, success: true, warning: "Your password changed, but we couldn't confirm sign-out on all devices. Log in and retry signing out other sessions from Profile." };
  }
  return { error: null, success: true };
}

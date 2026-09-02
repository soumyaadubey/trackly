"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reportError, userMessage } from "@/lib/errors";

export type ResetState = { error: string | null };

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

  // Reaching this page means a reset token was already exchanged for a session
  // at /auth/confirm. If that session is missing the link was never valid, and
  // updateUser would otherwise fail with a confusing message.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=reset-link-invalid");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: userMessage("updatePassword", error) };
  }

  // A reset is the other half of a compromise recovery: drop every other
  // session so an attacker who still holds one is evicted.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    reportError("updatePassword.signOutOthers", signOutError);
  }

  redirect("/opportunities");
}

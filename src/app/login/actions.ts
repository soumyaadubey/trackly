"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site";
import { safeNext } from "@/lib/safe-next";
import { reportError, userMessage } from "@/lib/errors";

export type AuthState = { error: string | null; confirmSent?: boolean };
export type ResetRequestState = { error: string | null; sent: boolean };

const MIN_PASSWORD_LENGTH = 8;

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // Where they were headed before the proxy sent them here. Validated, because
  // it arrives from a URL the user controls and ends up in a redirect.
  const next = safeNext(formData.get("next") as string | null);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    reportError("login", error);
    // Deliberately uniform: a distinct "no such account" message would let an
    // unauthenticated caller enumerate which addresses are registered.
    return { error: "That email and password don't match an account." };
  }

  redirect(next);
}

export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next") as string | null);

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: userMessage("signup", error) };
  }

  if (!data.session) {
    // Email confirmation is required — no session was created yet.
    return { error: null, confirmSent: true };
  }

  redirect(next);
}

export async function requestPasswordReset(
  _prevState: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email first.", sent: false };
  }

  // The origin comes from configuration, never from the request's Host or
  // X-Forwarded-Host header. Building it from the header meant an attacker
  // could request a reset for someone else's address, spoof the header, and
  // have the emailed link — carrying a valid token — point at their own site.
  const origin = await getSiteOrigin();

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    reportError("requestPasswordReset", error);
  }

  // Always report success. Telling the caller whether the address was found
  // turns this form into an account-existence oracle.
  return { error: null, sent: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

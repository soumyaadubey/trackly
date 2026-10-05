"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { updatePassword, type ResetState } from "./actions";
import { PAGE_MEASURE } from "@/lib/layout";
import { SESSION_EXPIRY_NOTE } from "@/lib/auth-feedback";

const initialState: ResetState = { error: null };

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState(async (previous: ResetState, data: FormData) => {
    const result = await updatePassword(previous, data);
    if (result.success) {
      setPassword("");
      setConfirmation("");
    }
    return result;
  }, initialState);

  return (
    <div className="flex flex-1 flex-col" style={{ background: "var(--panel)" }}>
      {/* Same dead end the legal pages had: landing here from an email link
          left no way out except the browser's back button. */}
      <header className={`mx-auto flex w-full ${PAGE_MEASURE} items-center justify-between px-7 py-5`}>
        <Link
          href="/"
          className="flex items-center gap-2 font-serif text-[19px] leading-none"
          style={{ color: "var(--ink)" }}
        >
          <Logo size={26} />
          Trackly
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 items-start justify-center px-4 pb-16 pt-4">
      <div
        className="w-full max-w-[420px] rounded p-9"
        style={{ background: "var(--paper)", border: "1px solid var(--border)" }}
      >
        <h2 className="font-serif mb-6 text-[26px]" style={{ color: "var(--ink)" }}>
          Set a new password.
        </h2>

        {state.success ? (
          <div className="space-y-4" role="status">
            <p>Password updated. Log in with your new password.</p>
            {state.warning && <p className="field-error">{state.warning}</p>}
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>{SESSION_EXPIRY_NOTE}</p>
            <Link href="/login" className="pill-btn-primary inline-block">Log in</Link>
          </div>
        ) : <form action={formAction} className="space-y-5">
          <div>
            <label htmlFor="password" className="field-label block">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={state.error ? "reset-error" : undefined}
              required
              minLength={8}
              autoComplete="new-password"
              className="field-input"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="field-label block">Confirm new password</label>
            <input id="confirm-password" name="confirm_password" type="password" required
              value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
              minLength={8} autoComplete="new-password" className="field-input"
              aria-describedby={state.error ? "reset-error" : undefined} />
          </div>
          {state.error && <p id="reset-error" role="alert" className="field-error">{state.error}</p>}

          <button type="submit" disabled={pending} className="pill-btn-primary w-full text-center text-[14px]">
            {pending ? "Saving…" : "Update password"}
          </button>
          <Link href="/login?mode=forgot" className="block text-sm underline">Request a new reset link</Link>
        </form>}
      </div>
      </div>
    </div>
  );
}

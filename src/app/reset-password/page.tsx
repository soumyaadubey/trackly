"use client";

import { useActionState } from "react";
import { updatePassword, type ResetState } from "./actions";

const initialState: ResetState = { error: null };

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4" style={{ background: "var(--panel)" }}>
      <div
        className="w-full max-w-[420px] rounded p-9"
        style={{ background: "var(--paper)", border: "1px solid var(--border)" }}
      >
        <h2 className="font-serif mb-6 text-[26px]" style={{ color: "var(--ink)" }}>
          Set a new password.
        </h2>

        <form action={formAction} className="space-y-5">
          <div>
            <label htmlFor="password" className="field-label block">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="field-input"
            />
          </div>

          {state.error && <p className="field-error">{state.error}</p>}

          <button type="submit" disabled={pending} className="pill-btn-primary w-full text-center text-[14px]">
            {pending ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

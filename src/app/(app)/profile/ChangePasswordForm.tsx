"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = { error: null, success: false };

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    // The key resets the inputs once a change succeeds, so the fields don't sit
    // there still holding a password.
    <form action={formAction} className="space-y-4" key={state.success ? "done" : "form"}>
      {/* Requiring the current password is what stops a borrowed session from
          becoming a permanent account takeover. */}
      <div>
        <label htmlFor="current_password" className="field-label block">
          Current password
        </label>
        <input
          id="current_password"
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label block">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="confirm_password" className="field-label block">
          Confirm new password
        </label>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="field-input"
        />
      </div>

      {state.error && <p className="field-error">{state.error}</p>}
      {state.success && (
        <p className="text-sm" style={{ color: "var(--ink)" }}>
          Password updated. Any other devices you were signed in on have been
          signed out.
        </p>
      )}

      <button type="submit" disabled={pending} className="pill-btn-primary text-[13px]">
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = { error: null, success: false };

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="space-y-4" key={state.success ? "done" : "form"}>
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
      {state.success && (
        <p className="text-sm" style={{ color: "var(--ink)" }}>
          Password updated.
        </p>
      )}

      <button type="submit" disabled={pending} className="pill-btn-primary text-[13px]">
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

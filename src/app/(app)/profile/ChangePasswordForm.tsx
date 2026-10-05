"use client";

import { useActionState } from "react";
import { changePassword, signOutOtherSessions, type ChangePasswordState } from "./actions";
import { SESSION_EXPIRY_NOTE } from "@/lib/auth-feedback";

const initialState: ChangePasswordState = { error: null, success: false };

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const [sessionState, sessionAction, sessionPending] = useActionState(signOutOtherSessions, initialState);

  return (
    // The key resets the inputs once a change succeeds, so the fields don't sit
    // there still holding a password.
    <>
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

      {state.error && <p role="alert" className="field-error">{state.error}</p>}
      {state.success && (
        <p role="status" className="text-sm" style={{ color: "var(--ink)" }}>
          {state.warning ?? "Password updated. Other sessions can no longer refresh their access."}
        </p>
      )}

      <button type="submit" disabled={pending} className="pill-btn-primary text-[13px]">
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
    <form action={sessionAction} className="mt-5 space-y-3">
      <button type="submit" disabled={sessionPending} className="pill-btn-secondary text-[13px]">
        {sessionPending ? "Signing out…" : "Sign out other sessions"}
      </button>
      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>{SESSION_EXPIRY_NOTE}</p>
      {sessionState.error && <p role="alert" className="field-error">{sessionState.error}</p>}
      {sessionState.success && <p role="status" className="text-sm">Other sessions can no longer refresh their access.</p>}
    </form>
    </>
  );
}

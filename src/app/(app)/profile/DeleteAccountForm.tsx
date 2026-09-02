"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteAccountState } from "./actions";

const initialState: DeleteAccountState = { error: null };

/**
 * Self-serve account deletion.
 *
 * The privacy policy already promised users could delete everything; the only
 * documented route was "open an issue on the project's GitHub repository",
 * which is linked nowhere in the app. Beyond the broken promise, GDPR Article
 * 17 expects an erasure path that actually works.
 */
export default function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pill-btn-delete text-[13px]"
      >
        Delete my account
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        This removes your account, every opportunity, course and roadmap you
        have saved, and your profile photo. It cannot be undone. Export your
        data first if you want to keep it.
      </p>

      <div>
        <label htmlFor="delete-password" className="field-label block">
          Your password
        </label>
        <input
          id="delete-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="delete-confirmation" className="field-label block">
          Type DELETE to confirm
        </label>
        <input
          id="delete-confirmation"
          name="confirmation"
          type="text"
          required
          autoComplete="off"
          placeholder="DELETE"
          className="field-input"
        />
      </div>

      {state.error && <p className="field-error">{state.error}</p>}

      <div className="flex items-center gap-2.5">
        <button type="submit" disabled={pending} className="pill-btn-delete text-[13px]">
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="pill-btn-secondary text-[13px]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

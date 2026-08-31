"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "./actions";

const initialState: ProfileState = { error: null, success: false };

export default function ProfileForm({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4.5">
        <div>
          <label htmlFor="first_name" className="field-label block">
            First name
          </label>
          <input
            id="first_name"
            name="first_name"
            type="text"
            defaultValue={firstName}
            autoComplete="given-name"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="last_name" className="field-label block">
            Last name
          </label>
          <input
            id="last_name"
            name="last_name"
            type="text"
            defaultValue={lastName}
            autoComplete="family-name"
            className="field-input"
          />
        </div>
      </div>

      {state.error && <p className="field-error">{state.error}</p>}
      {state.success && (
        <p className="text-sm" style={{ color: "var(--ink)" }}>
          Saved.
        </p>
      )}

      <button type="submit" disabled={pending} className="pill-btn-primary text-[13px]">
        {pending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useRef, useState } from "react";
import { updateAvatar, type ProfileState } from "./actions";

const initialState: ProfileState = { error: null, success: false };

export default function AvatarForm({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null;
  initials: string;
}) {
  const [state, formAction, pending] = useActionState(updateAvatar, initialState);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = preview ?? avatarUrl;

  return (
    <form action={formAction} className="flex items-center gap-5">
      <div
        className="avatar-circle flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-medium"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          name="avatar"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPreview(URL.createObjectURL(file));
          }}
          className="text-[13px]"
          style={{ color: "var(--ink-muted)" }}
        />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="pill-btn-secondary text-[13px]">
            {pending ? "Uploading…" : "Upload photo"}
          </button>
          {state.error && <p className="field-error">{state.error}</p>}
          {state.success && !state.error && (
            <p className="text-sm" style={{ color: "var(--ink)" }}>
              Updated.
            </p>
          )}
        </div>
        <p className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
          JPG, PNG, or GIF. Up to 2MB.
        </p>
      </div>
    </form>
  );
}

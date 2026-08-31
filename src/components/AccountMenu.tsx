"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import { displayName, initialsFor } from "@/lib/user";

export default function AccountMenu({
  email,
  firstName = "",
  lastName = "",
  avatarUrl = null,
}: {
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = initialsFor(firstName, lastName, email);
  const name = displayName(firstName, lastName, email);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="avatar-circle flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[12px] font-medium"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 z-10 w-56 rounded py-1.5"
          style={{ background: "var(--paper)", border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(0,0,0,.1)" }}
        >
          <div
            className="truncate px-3.5 py-2"
            style={{ borderBottom: "1px solid var(--border-soft)" }}
          >
            <div className="truncate text-[13px] font-medium" style={{ color: "var(--ink)" }}>
              {name}
            </div>
            {name !== email && (
              <div className="truncate text-[12px]" style={{ color: "var(--ink-faint)" }}>
                {email}
              </div>
            )}
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="row-hover block px-3.5 py-2 text-[13px]"
            style={{ color: "var(--ink)" }}
          >
            Profile
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="row-hover block w-full px-3.5 py-2 text-left text-[13px]"
              style={{ color: "var(--ink)" }}
            >
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import {
  login,
  signup,
  requestPasswordReset,
  type AuthState,
  type ResetRequestState,
} from "./actions";

const initialState: AuthState = { error: null };
const initialResetState: ResetRequestState = { error: null, sent: false };

export default function LoginForm({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
    initialResetState,
  );

  const action = mode === "login" ? loginAction : signupAction;
  const state = mode === "login" ? loginState : signupState;
  const pending = mode === "login" ? loginPending : signupPending;

  return (
    <div className="flex flex-1 flex-col" style={{ background: "var(--panel)" }}>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-7 py-5">
        <Link href="/" className="flex items-center gap-2 font-serif text-[19px]" style={{ color: "var(--ink)" }}>
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
          {mode === "signup" && signupState.confirmSent ? (
            <>
              <h2 className="font-serif mb-2 text-[26px]" style={{ color: "var(--ink)" }}>
                Check your email.
              </h2>
              <p className="mb-6 text-[13px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                We sent a confirmation link to finish setting up your account.
                Click it, then come back and log in.
              </p>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-serif block w-full text-center text-[13px] italic"
                style={{ color: "var(--ink-muted)" }}
              >
                ← Back to log in
              </button>
            </>
          ) : mode !== "forgot" ? (
            <>
              <div
                className="mb-7 flex gap-1.5 rounded-full p-1"
                style={{ background: "var(--paper-line)" }}
              >
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="flex-1 rounded-full py-2 text-[13px] font-medium transition-colors"
                  style={
                    mode === "login"
                      ? { background: "var(--paper)", color: "var(--ink)", boxShadow: "0 1px 2px rgba(0,0,0,.07)" }
                      : { color: "var(--ink-muted)" }
                  }
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="flex-1 rounded-full py-2 text-[13px] font-medium transition-colors"
                  style={
                    mode === "signup"
                      ? { background: "var(--paper)", color: "var(--ink)", boxShadow: "0 1px 2px rgba(0,0,0,.07)" }
                      : { color: "var(--ink-muted)" }
                  }
                >
                  Sign up
                </button>
              </div>

              <h2 className="font-serif mb-6 text-[26px]" style={{ color: "var(--ink)" }}>
                {mode === "login" ? "Welcome back" : "Let's get started"}
                <span className="relative inline-block italic" style={{ color: "var(--accent)" }}>
                  .
                  <svg
                    width="60"
                    height="10"
                    viewBox="0 0 60 14"
                    style={{ position: "absolute", left: -58, bottom: -6 }}
                    fill="none"
                  >
                    <path
                      d="M2 9C12 3 24 3 34 7C42 10 50 10 58 5"
                      stroke="var(--accent)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h2>

              {initialError === "reset-link-invalid" && (
                <p className="field-error mb-4">
                  That reset link is invalid or has expired. Request a new one below.
                </p>
              )}

              <form action={action} className="space-y-5">
                <div>
                  <label htmlFor="email" className="field-label block">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="field-input"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="field-label block">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="field-input"
                  />
                </div>

                {state.error && <p className="field-error">{state.error}</p>}

                <button
                  type="submit"
                  disabled={pending}
                  className="pill-btn-primary w-full text-center text-[14px]"
                >
                  {pending
                    ? "Please wait…"
                    : mode === "login"
                      ? "Log in"
                      : "Sign up"}
                </button>
              </form>

              {/* In signup mode this reads "Already have an account?", so it has
                  to go to the login form. It used to call setMode("forgot")
                  unconditionally, dropping new users onto the password-reset
                  screen from the second-most-clicked control on the page. */}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "forgot" : "login")}
                className="font-serif mt-4 block w-full text-center text-[13px] italic"
                style={{ color: "var(--ink-muted)" }}
              >
                {mode === "login" ? "Forgot your password?" : "Already have an account?"}
              </button>
            </>
          ) : (
            <>
              <h2 className="font-serif mb-2 text-[26px]" style={{ color: "var(--ink)" }}>
                Reset your password.
              </h2>
              <p className="mb-6 text-[13px]" style={{ color: "var(--ink-muted)" }}>
                We&apos;ll email you a link to set a new one.
              </p>

              {resetState.sent ? (
                <p className="text-sm" style={{ color: "var(--ink)" }}>
                  Check your email for a reset link.
                </p>
              ) : (
                <form action={resetAction} className="space-y-5">
                  <div>
                    <label htmlFor="reset-email" className="field-label block">
                      Email
                    </label>
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      className="field-input"
                    />
                  </div>

                  {resetState.error && <p className="field-error">{resetState.error}</p>}

                  <button
                    type="submit"
                    disabled={resetPending}
                    className="pill-btn-primary w-full text-center text-[14px]"
                  >
                    {resetPending ? "Sending…" : "Send reset link"}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-serif mt-4 block w-full text-center text-[13px] italic"
                style={{ color: "var(--ink-muted)" }}
              >
                ← Back to log in
              </button>
            </>
          )}
        </div>
      </div>

      <footer
        className="mx-auto w-full max-w-3xl px-7 pb-8 text-center text-xs"
        style={{ color: "var(--ink-faint)" }}
      >
        <Link href="/privacy" style={{ color: "inherit" }}>
          Privacy
        </Link>
        {" · "}
        <Link href="/terms" style={{ color: "inherit" }}>
          Terms
        </Link>
      </footer>
    </div>
  );
}

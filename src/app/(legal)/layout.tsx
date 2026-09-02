import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Chrome for the two legal pages.
 *
 * These were previously rendered bare: no header, no footer, no link back —
 * once you followed the footer link from the landing page you were stranded,
 * with the browser's back button as the only way out.
 *
 * Deliberately session-free, so both pages stay statically prerendered. "/" is
 * the right destination either way: signed out it is the landing page, signed
 * in it is the dashboard.
 */
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col" style={{ background: "var(--panel)" }}>
      <header
        className="mx-auto flex w-full max-w-2xl items-center justify-between px-7 py-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
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

      <main className="flex-1">{children}</main>

      <footer
        className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 px-7 py-6 text-[13px]"
        style={{ color: "var(--ink-muted)", borderTop: "1px solid var(--border)" }}
      >
        <Link href="/" className="pill-btn-secondary text-[13px]">
          ← Back to Trackly
        </Link>
        <span className="flex gap-5.5">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </span>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { PAGE_MEASURE } from "@/lib/layout";

/**
 * The app's footer: wordmark on the left, legal links on the right.
 *
 * Extracted from the landing page, which was the only screen that had one —
 * so once you signed in, Privacy and Terms became unreachable from anywhere in
 * the product. Same markup and measurements as before, now shared.
 */
export default function SiteFooter() {
  return (
    <footer
      className={`mx-auto flex w-full ${PAGE_MEASURE} items-center justify-between px-4 py-5 text-[13px] sm:px-7`}
      style={{ color: "var(--ink-muted)", borderTop: "1px solid var(--border)" }}
    >
      <span className="font-serif italic">Trackly</span>
      <span className="flex gap-5.5">
        <Link href="/privacy" className="footer-link">
          Privacy
        </Link>
        <Link href="/terms" className="footer-link">
          Terms
        </Link>
      </span>
    </footer>
  );
}

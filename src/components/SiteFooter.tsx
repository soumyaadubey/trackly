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
      <span className="flex items-center gap-5.5">
        {/* rel="noreferrer" alongside noopener: the target is a public repo,
            but there is no reason to hand it the referring URL either. */}
        <a
          href="https://github.com/soumyaadubey/trackly"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link tap-target"
        >
          GitHub
        </a>
        <Link href="/privacy" className="footer-link tap-target">
          Privacy
        </Link>
        <Link href="/terms" className="footer-link tap-target">
          Terms
        </Link>
      </span>
    </footer>
  );
}

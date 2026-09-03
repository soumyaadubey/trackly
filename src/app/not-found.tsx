import Link from "next/link";
import { PAGE_MEASURE } from "@/lib/layout";

export default function NotFound() {
  return (
    <div className={`mx-auto w-full ${PAGE_MEASURE} px-7 py-10`}>
      <div
        className="rounded px-7 py-16 text-center"
        style={{ background: "var(--paper)", border: "1px solid var(--border)" }}
      >
        <div className="font-serif text-[76px] italic leading-none" style={{ color: "var(--accent)" }}>
          404
        </div>
        <h2 className="font-serif mt-3.5 mb-2.5 text-2xl" style={{ color: "var(--ink)" }}>
          This one got away.
        </h2>
        <p className="mx-auto mb-6 max-w-sm text-[15px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          The page doesn&apos;t exist, or whatever it pointed to was deleted.
        </p>
        <Link href="/opportunities" className="pill-btn-primary inline-block text-[14px]">
          Back to my list
        </Link>
      </div>
    </div>
  );
}

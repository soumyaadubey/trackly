"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KINDS, KIND_CONFIG, KIND_ROUTE } from "@/lib/items";

// Overview is listed explicitly: the logo used to be the only way back to the
// dashboard, which nothing on screen said.
const SECTIONS = [
  { href: "/", label: "Overview", isActive: (path: string) => path === "/" },
  ...KINDS.map((kind) => ({
    href: KIND_ROUTE[kind],
    label: KIND_CONFIG[kind].pluralLabel,
    isActive: (path: string) => path.startsWith(KIND_ROUTE[kind]),
  })),
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="flex flex-wrap items-center gap-1.5">
      {SECTIONS.map(({ href, label, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors"
            style={
              active
                ? { background: "var(--accent)", color: "var(--accent-fg)" }
                : { color: "var(--ink-muted)" }
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

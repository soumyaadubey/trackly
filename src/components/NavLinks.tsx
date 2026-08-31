"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KINDS, KIND_CONFIG, KIND_ROUTE } from "@/lib/items";

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1.5">
      {KINDS.map((kind) => {
        const href = KIND_ROUTE[kind];
        const active = pathname.startsWith(href);
        return (
          <Link
            key={kind}
            href={href}
            className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors"
            style={
              active
                ? { background: "var(--accent)", color: "var(--accent-fg)" }
                : { color: "var(--ink-muted)" }
            }
          >
            {KIND_CONFIG[kind].pluralLabel}
          </Link>
        );
      })}
    </nav>
  );
}

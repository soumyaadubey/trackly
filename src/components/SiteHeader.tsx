import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import NavLinks from "@/components/NavLinks";
import Logo from "@/components/Logo";
import { PAGE_MEASURE } from "@/lib/layout";

/**
 * The signed-in app chrome.
 *
 * This used to live in the root layout, which made the layout `async` and had
 * it read the session cookie — so every route in the app became dynamically
 * rendered, the marketing page and the two legal pages included. Those three
 * have nothing to do with the session and can be served from the edge; keeping
 * the auth read down here is what lets them.
 */
export default async function SiteHeader() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <header style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
      <div className={`mx-auto w-full ${PAGE_MEASURE} px-7 py-4`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-7">
            <Link
              href="/"
              className="flex items-center gap-2 font-serif text-[19px] leading-none"
              style={{ color: "var(--ink)" }}
            >
              <Logo size={26} />
              Trackly
            </Link>
            <div className="hidden sm:block">
              <NavLinks />
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <ThemeToggle />
            <AccountMenu
              email={user.email ?? ""}
              firstName={(user.user_metadata?.first_name as string) ?? ""}
              lastName={(user.user_metadata?.last_name as string) ?? ""}
              avatarUrl={(user.user_metadata?.avatar_url as string) ?? null}
            />
          </div>
        </div>
        <div className="mt-3 sm:hidden">
          <NavLinks />
        </div>
      </div>
    </header>
  );
}

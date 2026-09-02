import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import Home from "@/components/Home";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Logo from "@/components/Logo";
import { ClockIcon, LinkIcon } from "@/components/icons";

export default async function RootPage() {
  const user = await getCurrentUser();

  if (user) {
    const greetingName =
      (user.user_metadata?.first_name as string) || (user.email ?? "there").split("@")[0];
    // This route serves two different pages. The signed-in one needs the app
    // chrome that the (app) route group provides to everything else.
    return (
      <>
        <SiteHeader />
        <div className="flex-1">
          <Home name={greetingName} />
        </div>
        <SiteFooter />
      </>
    );
  }

  return (
    <div className="flex flex-1 flex-col" style={{ background: "var(--panel)" }}>
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-5 sm:px-7">
        <div className="flex items-center gap-2 font-serif text-[20px]" style={{ color: "var(--ink)" }}>
          <Logo size={27} />
          Trackly
        </div>
        <div className="flex items-center gap-2.5 sm:gap-4.5">
          <ThemeToggle />
          <Link href="/login" className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>
            Log in
          </Link>
          <Link href="/login" className="pill-btn-primary text-sm">
            Sign up
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 sm:px-7">
        <div
          className="ruled mb-5 rounded px-6 py-10 sm:px-14"
          style={{ border: "1px solid var(--border)", paddingTop: "72px", paddingBottom: "60px" }}
        >
          <h1
            className="font-serif mb-9 max-w-2xl text-[32px] font-normal leading-[1.15] sm:text-[50px]"
            style={{ color: "var(--ink)", letterSpacing: "-0.015em" }}
          >
            Every application you meant to finish, on one page.
          </h1>
          <p className="mb-9 max-w-xl text-base leading-8 sm:text-lg sm:leading-9" style={{ color: "var(--ink-muted)" }}>
            Hackathon applications, courses you meant to start, roadmaps you
            bookmarked and never opened again — this is the one page that
            remembers all of it, so your browser tabs don&apos;t have to.
          </p>
          <div className="flex items-center gap-4.5">
            <Link href="/login" className="pill-btn-primary text-[15px]">
              Sign up
            </Link>
            <span className="font-serif text-sm italic" style={{ color: "var(--ink-faint)" }}>
              Free. Export anytime.
            </span>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded p-7" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
            <div className="mb-3 flex items-center gap-2.5">
              <ClockIcon size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <div className="font-serif text-[15px] italic" style={{ color: "var(--accent)" }}>
                Deadlines, weighted
              </div>
            </div>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              Overdue items stay visibly urgent, due-this-week ones sit right
              behind them. The rest stay quiet. You should be able to scan
              the page in four seconds.
            </p>
          </div>
          <div className="rounded p-7" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
            <div className="mb-3 flex items-center gap-2.5">
              <LinkIcon size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <div className="font-serif text-[15px] italic" style={{ color: "var(--accent)" }}>
                Notes stay with the link
              </div>
            </div>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              Who referred you, which essay you reused, where you left off in
              a course. It lives on the row, not scattered across another
              app.
            </p>
          </div>
        </div>

        <div
          className="flex flex-col items-start justify-between gap-5 rounded p-9 sm:flex-row sm:items-center"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          <div className="font-serif max-w-md text-2xl leading-snug">
            Add the first one in about fifteen seconds.
          </div>
          <Link
            href="/login"
            className="rounded-full px-6.5 py-3.5 text-[15px] font-medium"
            style={{ background: "var(--paper)", color: "var(--ink)" }}
          >
            Sign up
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

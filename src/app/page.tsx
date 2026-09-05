import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { PAGE_MEASURE } from "@/lib/layout";
import ThemeToggle from "@/components/ThemeToggle";
import Home from "@/components/Home";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LandingBoard from "@/components/LandingBoard";
import Logo from "@/components/Logo";
import { ClockIcon, ExitIcon, LinkIcon } from "@/components/icons";

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
      <header className={`mx-auto flex w-full ${PAGE_MEASURE} items-center justify-between px-4 py-5 sm:px-7`}>
        <div className="flex items-center gap-2 py-1 font-serif text-[20px]" style={{ color: "var(--ink)" }}>
          <Logo size={27} />
          Trackly
        </div>
        <div className="flex items-center gap-2.5 sm:gap-4.5">
          <ThemeToggle />
          <Link href="/login" className="tap-target text-sm font-medium" style={{ color: "var(--ink-muted)" }}>
            Log in
          </Link>
          <Link href="/login?mode=signup" className="pill-btn-primary text-sm">
            Sign up
          </Link>
        </div>
      </header>

      <main className={`mx-auto w-full ${PAGE_MEASURE} flex-1 px-4 pb-16 sm:px-7`}>
        {/* Two columns from lg up: the pitch on the left, the board it's
            describing on the right. Stacked in one column below that, where
            side-by-side would squeeze both. The copy sits straight on the
            panel rather than in a card of its own, so the board stays the only
            raised surface in the hero. */}
        <div className="mb-5 grid grid-cols-1 items-center gap-9 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:pt-20">
          <div>
            <h1
              className="font-serif mb-5 text-[30px] font-normal leading-[1.1] sm:text-[42px]"
              style={{ color: "var(--ink)", letterSpacing: "-0.015em" }}
            >
              Every application you meant to finish, on one page.
            </h1>
            <p
              className="mb-8 max-w-xl text-[15px] leading-7 sm:text-[17px] sm:leading-8"
              style={{ color: "var(--ink-muted)" }}
            >
              Hackathon applications, courses you meant to start, roadmaps you
              bookmarked and never opened again — one list that remembers all
              of it, so your browser tabs don&apos;t have to.
            </p>
            <div className="flex items-center gap-4.5">
              <Link href="/login?mode=signup" className="pill-btn-primary text-[15px]">
                Sign up
              </Link>
              <span className="font-serif text-sm italic" style={{ color: "var(--ink-faint)" }}>
                Free. Export anytime.
              </span>
            </div>
          </div>

          <LandingBoard />
        </div>

        {/* Three across rather than two: at the wider measure a 2-up grid put the
            body text at ~72 characters a line, and left the pair looking like a
            third card had gone missing. */}
        <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
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
          <div className="rounded p-7" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
            <div className="mb-3 flex items-center gap-2.5">
              <ExitIcon size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <div className="font-serif text-[15px] italic" style={{ color: "var(--accent)" }}>
                Yours to walk away with
              </div>
            </div>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              Everything you save exports as a CSV, or as a calendar file your
              own calendar can read. No lock-in, and no waiting on support to
              get your list back.
            </p>
          </div>
        </div>

        {/* This block used to repeat the hero's headline and its Sign up
            button, which made three identical calls to action in one screen.
            The honest version of a closing pitch is what the product does not
            do — it is the only thing on the page a competitor's landing page
            would not also claim. One quiet text link, not a third pill. */}
        <div
          className="rounded p-9"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          <div className="font-serif mb-5 max-w-lg text-2xl leading-snug">
            What Trackly doesn&apos;t do.
          </div>
          <ul className="mb-6 grid grid-cols-1 gap-x-10 gap-y-3 text-[15px] leading-relaxed sm:grid-cols-2" style={{ color: "var(--paper)", opacity: 0.72 }}>
            <li>No team features. It&apos;s a list for one person.</li>
            <li>No reminder emails yet — export to your calendar instead.</li>
            <li>No AI writing your applications for you.</li>
            <li>No pricing page, because there&apos;s nothing to sell you.</li>
          </ul>
          <Link
            href="/login?mode=signup"
            className="tap-target text-[15px] font-medium underline underline-offset-4"
            style={{ color: "var(--paper)" }}
          >
            Start your list →
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

import type { Metadata } from "next";
import { Newsreader, Instrument_Sans } from "next/font/google";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import AccountMenu from "@/components/AccountMenu";
import NavLinks from "@/components/NavLinks";
import Logo from "@/components/Logo";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Trackly",
  description: "Track hackathon applications, courses, and roadmaps in one place.",
};

const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${instrumentSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning style={{ background: "var(--page)" }}>
        {user && (
          <header style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
            <div className="mx-auto w-full max-w-4xl px-7 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-7">
                  <Link href="/" className="flex items-center gap-2 font-serif text-[19px] leading-none" style={{ color: "var(--ink)" }}>
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
        )}
        {children}
      </body>
    </html>
  );
}

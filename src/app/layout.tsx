import type { Metadata } from "next";
import { Newsreader, Instrument_Sans } from "next/font/google";
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

/**
 * Runs before first paint.
 *
 * 1. Applies the saved theme, so a dark-mode user doesn't get a flash of the
 *    light palette. `dark` is explicit; anything else follows the OS.
 * 2. Records the viewer's UTC offset in a cookie, so the server can render
 *    deadlines against the viewer's own "today" instead of UTC. Written on
 *    every load rather than only when absent, so travel and DST transitions
 *    are picked up. Not sensitive, and not used for anything but date maths.
 */
const INIT_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}
try{document.cookie='tzo='+(-new Date().getTimezoneOffset())+';path=/;max-age=31536000;samesite=lax'}catch(e){}`;

/**
 * The root layout is deliberately session-free.
 *
 * It used to be `async` and call auth.getUser(), which opted every route in the
 * app — the landing page, /privacy, /terms — into dynamic rendering and a
 * Supabase round-trip. The signed-in chrome now lives in SiteHeader, rendered
 * by the (app) route group and by the authenticated branch of the home page.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${instrumentSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
      </head>
      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning
        style={{ background: "var(--page)" }}
      >
        {children}
      </body>
    </html>
  );
}

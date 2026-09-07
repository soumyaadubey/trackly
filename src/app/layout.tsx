import type { Metadata, Viewport } from "next";
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

/**
 * The origin used to build absolute URLs in the page metadata.
 *
 * NEXT_PUBLIC_SITE_URL is the answer when it is set. Vercel's own
 * VERCEL_PROJECT_PRODUCTION_URL is the fallback, because a missing variable
 * used to mean every shared link advertised an og:image on localhost — a
 * broken preview card, with nothing in the build output to say so.
 *
 * This is deliberately more forgiving than getSiteOrigin() in lib/site.ts,
 * which throws instead. That one builds password-reset links, where guessing
 * wrong hands a valid token to the wrong origin; this one picks a preview
 * image.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
const DESCRIPTION =
  "Track hackathon applications, courses, and roadmaps in one place.";

export const metadata: Metadata = {
  // Without this, the relative image path below is emitted as-is and every
  // scraper that requires an absolute og:image URL — LinkedIn included —
  // silently renders the link with no preview card at all.
  metadataBase: new URL(SITE_URL),
  title: "Trackly",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Trackly",
    title: "Trackly",
    description: DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Trackly — a board of upcoming application, course and roadmap deadlines",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trackly",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

/**
 * Tints the browser's own chrome — the address bar on Android, the tab strip
 * and title bar on desktop — to match the page instead of leaving it default
 * grey. Two entries so it follows the OS setting; these are the --page values
 * from globals.css and must be kept in step with them.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f0e0" },
    { media: "(prefers-color-scheme: dark)", color: "#14140d" },
  ],
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

export const metadata = { title: "Privacy Policy — Trackly" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-7 py-12">
      <h1 className="font-serif mb-2 text-2xl" style={{ color: "var(--ink)" }}>
        Privacy Policy
      </h1>
      <p className="mb-6 text-xs" style={{ color: "var(--ink-faint)" }}>
        Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })}
      </p>
      <div
        className="space-y-6 rounded p-7 text-sm leading-relaxed"
        style={{ background: "var(--paper)", border: "1px solid var(--border)", color: "var(--ink-muted)" }}
      >
        <section>
          <h2 className="font-serif mb-2 text-base" style={{ color: "var(--ink)" }}>
            What we collect
          </h2>
          <p>
            Your account email and password (handled entirely by our
            authentication provider — we never see or store your password
            directly), and whatever you choose to enter into Trackly:
            titles, links, statuses, deadlines, tags, and notes for the
            opportunities, courses, and roadmaps you track.
          </p>
        </section>
        <section>
          <h2 className="font-serif mb-2 text-base" style={{ color: "var(--ink)" }}>
            How your data is used
          </h2>
          <p>
            Solely to show your own list back to you. We don&apos;t analyze,
            aggregate, or use your data for anything beyond running the app.
            Every account&apos;s data is isolated at the database level, so
            other users can never see it.
          </p>
        </section>
        <section>
          <h2 className="font-serif mb-2 text-base" style={{ color: "var(--ink)" }}>
            Who else sees it
          </h2>
          <p>
            Nobody. We don&apos;t sell data or share it with advertisers or
            third parties. Data is hosted with Supabase (database and
            authentication) and the app itself is hosted with Vercel — both
            process data on our behalf as infrastructure providers, under
            their own standard hosting agreements, and neither has any
            independent use for your data.
          </p>
        </section>
        <section>
          <h2 className="font-serif mb-2 text-base" style={{ color: "var(--ink)" }}>
            Your control over it
          </h2>
          <p>
            You can edit or delete any item you&apos;ve added at any time
            from within the app — deletions take effect immediately. To
            delete your account and all associated data entirely, reach out
            using the contact details on the Terms page.
          </p>
        </section>
        <section>
          <h2 className="font-serif mb-2 text-base" style={{ color: "var(--ink)" }}>
            Cookies
          </h2>
          <p>
            Trackly uses one essential cookie to keep you signed in. No
            tracking or advertising cookies are used.
          </p>
        </section>
      </div>
    </div>
  );
}

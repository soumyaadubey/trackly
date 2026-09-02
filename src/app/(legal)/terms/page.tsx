export const metadata = { title: "Terms of Service — Trackly" };

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-7 py-12">
      <h1 className="font-serif mb-2 text-2xl" style={{ color: "var(--ink)" }}>
        Terms of Service
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
            The service
          </h2>
          <p>
            Trackly is a free tool for tracking hackathon and job
            applications, courses, and learning roadmaps. It&apos;s provided
            as-is, with no uptime or data-durability guarantee. Back up or
            export anything you can&apos;t afford to lose.
          </p>
        </section>
        <section>
          <h2 className="font-serif mb-2 text-base" style={{ color: "var(--ink)" }}>
            Acceptable use
          </h2>
          <p>
            Don&apos;t use Trackly to store illegal content, attempt to
            access another user&apos;s account or data, or abuse the
            signup/login system (automated account creation, credential
            stuffing, etc.). Accounts found doing so may be suspended or
            removed without notice.
          </p>
        </section>
        <section>
          <h2 className="font-serif mb-2 text-base" style={{ color: "var(--ink)" }}>
            Your content
          </h2>
          <p>
            You own everything you enter into Trackly. We claim no rights to
            it beyond what&apos;s needed to store and display it back to
            you, as described in the Privacy Policy.
          </p>
        </section>
        <section>
          <h2 className="font-serif mb-2 text-base" style={{ color: "var(--ink)" }}>
            Changes
          </h2>
          <p>
            These terms may change as the app evolves. Continuing to use
            Trackly after a change means you accept the updated terms.
          </p>
        </section>
        <section>
          <h2 className="font-serif mb-2 text-base" style={{ color: "var(--ink)" }}>
            Contact
          </h2>
          <p>
            You don&apos;t need to contact anyone to delete your account — do it
            yourself from <strong>Profile → Delete account</strong>, and export
            your data first from the same page if you want to keep a copy.
          </p>
          <p className="mt-3">
            For questions or bug reports, open an issue on the{" "}
            <a
              href="https://github.com/soumyaadubey/trackly"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              project&apos;s GitHub repository
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-7 py-10">
      <div
        className="rounded px-7 py-16 text-center"
        style={{ background: "var(--paper)", border: "1px solid var(--border)" }}
      >
        <h2 className="font-serif mb-3 text-2xl" style={{ color: "var(--ink)" }}>
          The list didn&apos;t load.
        </h2>
        <p className="mx-auto mb-6.5 max-w-md text-[15px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          Everything you&apos;ve saved is still there. This is the server not
          answering, and it usually answers on the second ask.
        </p>
        <button type="button" onClick={() => reset()} className="pill-btn-primary text-[14px]">
          Reload the list
        </button>
      </div>
    </div>
  );
}

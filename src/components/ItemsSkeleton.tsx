export default function ItemsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-7 py-8">
      <div className="rounded" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-6.5 py-4.5" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <div className="skeleton-bar h-8 w-40 rounded-full" />
          <div className="skeleton-bar h-9 w-32 rounded-full" />
        </div>
        <div className="flex flex-col gap-2.5 px-6.5 py-5">
          {[240, 180, 210].map((w, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton-bar h-4" style={{ width: w }} />
              <div className="skeleton-bar h-4 w-[86px] rounded-full" />
              <div className="skeleton-bar h-4 w-[70px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

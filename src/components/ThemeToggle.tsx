"use client";

function toggle() {
  const isDark = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem("theme", isDark ? "dark" : "light");
  } catch {}
}

export default function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs"
      style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
    >
      <span className="theme-toggle-sun">☀</span>
      <span aria-hidden> / </span>
      <span className="theme-toggle-moon">☾</span>
    </button>
  );
}

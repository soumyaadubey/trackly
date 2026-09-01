// Mirrors src/app/icon.svg (the browser-tab favicon) so the header wordmark
// and the tab icon are the same mark, not two approximations of it. Unlike
// the favicon, colors here use the theme's paper/accent vars so the badge
// doesn't stay a fixed light-cream chip against a dark header.
export default function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--paper)" />
      <text
        x="16"
        y="20"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="19"
        fill="var(--accent)"
      >
        T
      </text>
      <path
        d="M7 26.8c3.2-2.3 6.4-2.3 8.5 0c2.1 2.3 5.1 2.3 8.5 0"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

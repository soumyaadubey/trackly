export default function Logo({ size = 18 }: { size?: number }) {
  return (
    <span
      className="font-serif relative inline-block italic font-semibold"
      style={{ fontSize: size, lineHeight: 1, color: "var(--accent)" }}
    >
      T
      <svg
        width={size}
        height={size * 0.22}
        viewBox="0 0 46 14"
        style={{ position: "absolute", left: 0, bottom: -size * 0.22 }}
        fill="none"
      >
        <path
          d="M2 9C10 3 18 3 24 7C30 10 38 10 44 5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

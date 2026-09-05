import type { Kind } from "@/lib/items";

type IconProps = { size?: number; style?: React.CSSProperties; className?: string };

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function RocketIcon({ size = 18, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12 2c2.5 2 4 5.5 4 9 0 2-.5 4-1.5 6l-2.5 3-2.5-3C8.5 15 8 13 8 11c0-3.5 1.5-7 4-9Z" />
      <circle cx="12" cy="9" r="1.5" />
      <path d="M8.5 15 5 17l1-4" />
      <path d="M15.5 15 19 17l-1-4" />
    </svg>
  );
}

export function BookIcon({ size = 18, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5c.8 0 1.5-.7 1.5-1.5v-13Z" />
    </svg>
  );
}

export function CompassIcon({ size = 18, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-2 6-6 2 2-6 6-2Z" />
    </svg>
  );
}

export function ClockIcon({ size = 18, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function LinkIcon({ size = 18, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 12.6 4.9a3.5 3.5 0 0 1 5 5L16 11.5" />
      <path d="M13 17.5 11.4 19.1a3.5 3.5 0 0 1-5-5L8 12.5" />
    </svg>
  );
}

/** A door standing open, with an arrow leaving through it — your data, on its way out. */
export function ExitIcon({ size = 18, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <path d="M10 8l4 4-4 4" />
      <path d="M14 12H4" />
    </svg>
  );
}

export const KIND_ICON: Record<Kind, (props: IconProps) => React.JSX.Element> = {
  opportunity: RocketIcon,
  course: BookIcon,
  roadmap: CompassIcon,
};

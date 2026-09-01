"use client";

import { useState, useTransition } from "react";
import { KIND_CONFIG, type Kind } from "@/lib/items";
import { updateStatus } from "@/app/items/actions";

export default function StatusSelect({
  id,
  kind,
  status,
}: {
  id: string;
  kind: Kind;
  status: string;
}) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const config = KIND_CONFIG[kind];

  function handleChange(next: string) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await updateStatus(id, next);
      if (result.error) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className={`badge ${config.statusBadge[value]} relative`} style={{ opacity: isPending ? 0.6 : 1 }}>
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
        style={{ opacity: 0 }}
        aria-label="Status"
      >
        {config.statuses.map((s) => (
          <option key={s} value={s}>
            {config.statusLabels[s]}
          </option>
        ))}
      </select>
      <span className="pointer-events-none">{config.statusLabels[value]} ▾</span>
      {error && (
        <p
          role="alert"
          className="field-error absolute right-0 top-full z-10 mt-1 whitespace-nowrap text-[11px]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

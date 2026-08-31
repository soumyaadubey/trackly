"use client";

import { useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const config = KIND_CONFIG[kind];

  return (
    <div className={`badge ${config.statusBadge[status]} relative`} style={{ opacity: isPending ? 0.6 : 1 }}>
      <select
        defaultValue={status}
        disabled={isPending}
        onChange={(e) =>
          startTransition(() => {
            updateStatus(id, e.target.value);
          })
        }
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
      <span className="pointer-events-none">{config.statusLabels[status]} ▾</span>
    </div>
  );
}

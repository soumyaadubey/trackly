"use client";

import { useState, useTransition } from "react";
import { deleteItem } from "@/app/items/actions";

export default function DeleteButton({ id, title }: { id: string; title: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (confirm(`Delete "${title}"? This can't be undone.`)) {
            setError(null);
            startTransition(async () => {
              const result = await deleteItem(id);
              if (result.error) setError(result.error);
            });
          }
        }}
        className="row-action row-action-delete"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
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

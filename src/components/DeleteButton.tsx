"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useItemDelete } from "@/components/ItemUndoProvider";
import type { Item } from "@/lib/items";

export default function DeleteButton({ item }: { item: Item }) {
  const deleteItem = useItemDelete();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function disarmLater() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), 4000);
  }

  function handleDelete() {
    setError(null);
    setArmed(false);
    startTransition(async () => {
      const result = await deleteItem(item.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (timer.current) clearTimeout(timer.current);
    });
  }

  return (
    <div className="relative inline-block">
      {armed ? (
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="row-action row-action-delete"
            autoFocus
          >
            {isPending ? "Deleting…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="row-action"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setArmed(true);
            disarmLater();
          }}
          className="row-action row-action-delete"
          aria-label={`Delete ${item.title}`}
        >
          Delete
        </button>
      )}
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

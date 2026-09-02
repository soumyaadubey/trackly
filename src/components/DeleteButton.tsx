"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteItem, restoreItem } from "@/app/(app)/items/actions";
import type { Item } from "@/lib/items";

/**
 * Delete, with a way back.
 *
 * This used to call the browser's native confirm(): a blocking modal, visually
 * unrelated to the rest of the app, and — more importantly — the wrong pattern.
 * These rows are cheap to recreate and expensive to lose, so the right
 * affordance is undo, not a speed bump. A mis-click was previously
 * unrecoverable; the only route back was the CSV export.
 */

const UNDO_WINDOW_MS = 8000;

export default function DeleteButton({ item }: { item: Item }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [deleted, setDeleted] = useState(false);
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
      setDeleted(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setDeleted(false), UNDO_WINDOW_MS);
    });
  }

  function handleUndo() {
    setError(null);
    startTransition(async () => {
      const result = await restoreItem({
        id: item.id,
        kind: item.kind,
        title: item.title,
        url: item.url,
        status: item.status,
        tags: item.tags,
        deadline: item.deadline,
        notes: item.notes,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeleted(false);
    });
  }

  // The row itself disappears on revalidate; this only renders in the gap
  // before that lands, and as the anchor for the undo affordance.
  if (deleted) {
    return (
      <div className="relative inline-flex items-center gap-2">
        <span className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
          Deleted
        </span>
        <button
          type="button"
          onClick={handleUndo}
          disabled={isPending}
          className="row-action"
        >
          {isPending ? "Restoring…" : "Undo"}
        </button>
        {error && (
          <p role="alert" className="field-error absolute right-0 top-full z-10 mt-1 whitespace-nowrap text-[11px]">
            {error}
          </p>
        )}
      </div>
    );
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

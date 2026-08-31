"use client";

import { useTransition } from "react";
import { deleteItem } from "@/app/items/actions";

export default function DeleteButton({ id, title }: { id: string; title: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Delete "${title}"? This can't be undone.`)) {
          startTransition(() => {
            deleteItem(id);
          });
        }
      }}
      className="row-action row-action-delete"
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}

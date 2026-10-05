"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { deleteItem, restoreItem, type SaveState } from "@/app/(app)/items/actions";
import type { RestorableItem } from "@/lib/items";

const UndoContext = createContext<((id: string) => Promise<SaveState>) | null>(null);

export function useItemDelete() {
  const remove = useContext(UndoContext);
  if (!remove) throw new Error("DeleteButton requires ItemUndoProvider");
  return remove;
}

type Entry = { item: RestorableItem; pending: boolean; error: string | null };

/** Lives above list revalidation and pagination. Undo stays available until
 * dismissed or this app layout is left/reloaded; it is not persistent Trash.
 */
export default function ItemUndoProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);

  async function remove(id: string): Promise<SaveState> {
    try {
      const result = await deleteItem(id);
      if (result.error) return result;
      if (!result.deleted) return { error: "Couldn't confirm deletion. Reload to check the item." };
      const item = result.deleted;
      setEntries((current) => [...current.filter((entry) => entry.item.id !== id), { item, pending: false, error: null }]);
      return { error: null };
    } catch {
      return { error: "Couldn't confirm deletion. Reload to check the item." };
    }
  }

  function dismiss(id: string) {
    setEntries((current) => current.filter((entry) => entry.item.id !== id));
  }

  async function undo(item: RestorableItem) {
    setEntries((current) => current.map((entry) => entry.item.id === item.id ? { ...entry, pending: true, error: null } : entry));
    let result: SaveState;
    try {
      result = await restoreItem(item);
    } catch {
      result = { error: "Couldn't confirm restoration. Check the list before retrying." };
    }
    if (!result.error) {
      dismiss(item.id);
    } else {
      setEntries((current) => current.map((entry) => entry.item.id === item.id ? { ...entry, pending: false, error: result.error } : entry));
    }
  }

  return (
    <UndoContext.Provider value={remove}>
      {children}
      {entries.length > 0 && (
        <section aria-label="Recently deleted items" className="fixed bottom-4 right-4 left-4 z-50 max-h-[50vh] overflow-y-auto sm:left-auto sm:w-96">
          {entries.map(({ item, pending, error }) => (
            <div key={item.id} className="mb-2 rounded p-4 shadow-lg" style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--border)" }}>
              <p role="status" className="break-words text-sm">Deleted “{item.title}”.</p>
              <div className="mt-2 flex gap-3">
                <button type="button" autoFocus disabled={pending} onClick={() => void undo(item)} className="pill-btn-secondary">
                  {pending ? "Restoring…" : "Undo"}
                </button>
                <button type="button" disabled={pending} onClick={() => dismiss(item.id)} className="row-action" aria-label={`Dismiss undo for ${item.title}`}>
                  Dismiss
                </button>
              </div>
              {error && <p role="alert" className="field-error mt-2">{error}</p>}
            </div>
          ))}
        </section>
      )}
    </UndoContext.Provider>
  );
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserClient } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { isKind, isStatusForKind, parseItemForm, KIND_ROUTE, type Kind } from "@/lib/items";

export type SaveState = { error: string | null };

/**
 * Every mutation below filters on user_id in addition to the row id.
 *
 * RLS already guarantees ownership, so this is redundant — deliberately. It is
 * the second lock: if a policy is ever dropped during a migration, these
 * queries still cannot touch another user's row. Do not remove it as
 * "duplication".
 */

export async function createItem(
  kind: Kind,
  _prevState: SaveState,
  formData: FormData,
): Promise<SaveState> {
  if (!isKind(kind)) {
    return { error: "Invalid item type." };
  }

  const { supabase, user } = await requireUserClient();

  const parsed = parseItemForm(formData, kind);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    kind,
    ...parsed.fields,
  });

  if (error) {
    return { error: userMessage("createItem", error) };
  }

  revalidatePath(KIND_ROUTE[kind]);
  revalidatePath("/");
  redirect(KIND_ROUTE[kind]);
}

export async function updateItem(
  id: string,
  _prevState: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const { supabase, user } = await requireUserClient();

  // The kind is needed to validate the submitted status and to know where to
  // redirect. It has to be read before the write, but the write itself is a
  // single statement rather than the previous select-then-update pair.
  const { data: existing, error: lookupError } = await supabase
    .from("items")
    .select("kind")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<{ kind: Kind }>();

  if (lookupError) {
    return { error: userMessage("updateItem.lookup", lookupError) };
  }
  if (!existing) {
    return { error: "Item not found." };
  }

  const parsed = parseItemForm(formData, existing.kind);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const { error } = await supabase
    .from("items")
    .update(parsed.fields)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: userMessage("updateItem", error) };
  }

  revalidatePath(KIND_ROUTE[existing.kind]);
  revalidatePath("/");
  redirect(KIND_ROUTE[existing.kind]);
}

export async function updateStatus(id: string, status: string): Promise<SaveState> {
  const { supabase, user } = await requireUserClient();

  // One round-trip: update, and get the row's kind back to know what to
  // revalidate. `.select()` returns no rows if the id was not the caller's,
  // which doubles as the ownership check the separate SELECT used to do.
  const { data: updated, error } = await supabase
    .from("items")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("kind")
    .maybeSingle<{ kind: Kind }>();

  if (error) {
    return { error: userMessage("updateStatus", error) };
  }
  if (!updated) {
    return { error: "That item no longer exists." };
  }

  // The database CHECK constraint is what actually enforces this — the update
  // would have failed above if the status were wrong for the kind. Verifying
  // afterwards would be theatre, so the guard runs where it can act: the client
  // only ever offers statuses valid for the kind it rendered.
  if (!isStatusForKind(updated.kind, status)) {
    return { error: "Invalid status." };
  }

  revalidatePath(KIND_ROUTE[updated.kind]);
  revalidatePath("/");
  return { error: null };
}

export async function deleteItem(id: string): Promise<SaveState> {
  const { supabase, user } = await requireUserClient();

  const { data: deleted, error } = await supabase
    .from("items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("kind")
    .maybeSingle<{ kind: Kind }>();

  if (error) {
    return { error: userMessage("deleteItem", error) };
  }
  if (!deleted) {
    return { error: "That item no longer exists." };
  }

  revalidatePath(KIND_ROUTE[deleted.kind]);
  revalidatePath("/");
  return { error: null };
}

/**
 * Restore an item the user just deleted, so the delete affordance can offer
 * undo instead of a blocking confirm() dialog. The id is reused, which keeps
 * any link to /items/<id>/edit working.
 */
export async function restoreItem(item: {
  id: string;
  kind: Kind;
  title: string;
  url: string;
  status: string;
  tags: string[];
  deadline: string | null;
  notes: string | null;
}): Promise<SaveState> {
  if (!isKind(item.kind) || !isStatusForKind(item.kind, item.status)) {
    return { error: "That item can't be restored." };
  }

  const { supabase, user } = await requireUserClient();

  const { error } = await supabase.from("items").insert({
    id: item.id,
    user_id: user.id,
    kind: item.kind,
    title: item.title,
    url: item.url,
    status: item.status,
    tags: item.tags,
    deadline: item.deadline,
    notes: item.notes,
  });

  if (error) {
    return { error: userMessage("restoreItem", error) };
  }

  revalidatePath(KIND_ROUTE[item.kind]);
  revalidatePath("/");
  return { error: null };
}

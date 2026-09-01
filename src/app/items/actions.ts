"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  isKind,
  isStatusForKind,
  normalizeUrl,
  parseTags,
  KIND_ROUTE,
  type Kind,
} from "@/lib/items";

export type SaveState = { error: string | null };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createItem(
  kind: Kind,
  _prevState: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const { supabase, user } = await requireUser();

  if (!isKind(kind)) {
    return { error: "Invalid item type." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const url = normalizeUrl(String(formData.get("url") ?? ""));
  const status = String(formData.get("status") ?? "saved");
  const deadline = String(formData.get("deadline") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const tags = parseTags(formData.get("tags"));

  if (!title || !url) {
    return { error: "Title and URL are required." };
  }
  if (!isStatusForKind(kind, status)) {
    return { error: "Invalid status." };
  }

  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    kind,
    title,
    url,
    status,
    deadline,
    notes,
    tags,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(KIND_ROUTE[kind]);
  redirect(KIND_ROUTE[kind]);
}

export async function updateItem(
  id: string,
  _prevState: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("items")
    .select("kind")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<{ kind: Kind }>();

  if (!existing) {
    return { error: "Item not found." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const url = normalizeUrl(String(formData.get("url") ?? ""));
  const status = String(formData.get("status") ?? "saved");
  const deadline = String(formData.get("deadline") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const tags = parseTags(formData.get("tags"));

  if (!title || !url) {
    return { error: "Title and URL are required." };
  }
  if (!isStatusForKind(existing.kind, status)) {
    return { error: "Invalid status." };
  }

  const { error } = await supabase
    .from("items")
    .update({ title, url, status, deadline, notes, tags })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(KIND_ROUTE[existing.kind]);
  redirect(KIND_ROUTE[existing.kind]);
}

export async function updateStatus(id: string, status: string): Promise<SaveState> {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("items")
    .select("kind")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<{ kind: Kind }>();

  if (!existing || !isStatusForKind(existing.kind, status)) {
    return { error: "Invalid status." };
  }

  const { error } = await supabase
    .from("items")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(KIND_ROUTE[existing.kind]);
  return { error: null };
}

export async function deleteItem(id: string): Promise<SaveState> {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("items")
    .select("kind")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<{ kind: Kind }>();

  if (!existing) {
    return { error: "Item not found." };
  }

  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(KIND_ROUTE[existing.kind]);
  return { error: null };
}

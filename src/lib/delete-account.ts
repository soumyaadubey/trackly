import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Called only after verifying the current user's password in the server action. */
export async function removeAccountData(admin: SupabaseClient, userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("Invalid account id");
  }
  const bucket = admin.storage.from("avatars");
  // Collect pages before deleting so offsets cannot skip files. Traverse older
  // nested uploads too; new uploads are restricted to avatar.<ext> by policies.
  const folders = [userId];
  let operations = 0;
  while (folders.length) {
    const prefix = folders.pop()!;
    const paths: string[] = [];
    for (let offset = 0; ; offset += 100) {
      if (++operations > 1000) throw new Error("Avatar cleanup limit reached; retry deletion");
      const { data, error } = await bucket.list(prefix, {
        limit: 100, offset, sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      if (!data) throw new Error("Avatar listing returned no result");
      for (const entry of data) {
        if (entry.name.includes("/") || entry.name === "." || entry.name === "..") {
          throw new Error("Unexpected avatar path");
        }
        const path = `${prefix}/${entry.name}`;
        if (entry.id) paths.push(path);
        else folders.push(path);
      }
      if (data.length < 100) break;
    }
    for (let start = 0; start < paths.length; start += 100) {
      const { error } = await bucket.remove(paths.slice(start, start + 100));
      if (error) throw error;
    }
  }
  // Storage errors leave the auth record intact. Retrying tolerates files already
  // removed. Supabase refuses user deletion if a concurrent owned upload remains.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

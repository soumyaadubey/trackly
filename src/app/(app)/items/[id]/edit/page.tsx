import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ItemForm from "@/components/ItemForm";
import { updateItem } from "@/app/(app)/items/actions";
import { KIND_CONFIG, type Item } from "@/lib/items";
import { KIND_ICON } from "@/components/icons";

export default async function EditItemPage(props: PageProps<"/items/[id]/edit">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .single<Item>();

  if (!item) notFound();

  const boundUpdate = updateItem.bind(null, id);
  const config = KIND_CONFIG[item.kind];
  const Icon = KIND_ICON[item.kind];

  return (
    <div className="mx-auto w-full max-w-xl px-7 py-10">
      <h1 className="font-serif mb-5 flex items-center gap-2.5 text-2xl" style={{ color: "var(--ink)" }}>
        <Icon size={22} style={{ color: `var(--kind-${item.kind})` }} />
        Edit {config.label.toLowerCase()}
      </h1>
      <ItemForm
        kind={item.kind}
        action={boundUpdate}
        initial={item}
        submitLabel="Save changes"
      />
    </div>
  );
}

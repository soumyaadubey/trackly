import ItemForm from "@/components/ItemForm";
import { createItem } from "@/app/(app)/items/actions";
import { KIND_CONFIG, type Kind } from "@/lib/items";
import { KIND_ICON } from "@/components/icons";

/**
 * The "add an item" screen for any kind.
 *
 * The three routes that use this were byte-for-byte identical apart from the
 * kind, its icon, and a label — all three of which already had lookup tables
 * in KIND_CONFIG and KIND_ICON.
 */
export default function NewItemPage({ kind }: { kind: Kind }) {
  const config = KIND_CONFIG[kind];
  const Icon = KIND_ICON[kind];
  const label = config.label.toLowerCase();

  return (
    <div className="mx-auto w-full max-w-xl px-7 py-10">
      <h1
        className="font-serif mb-5 flex items-center gap-2.5 text-2xl"
        style={{ color: "var(--ink)" }}
      >
        <Icon size={22} style={{ color: `var(--kind-${kind})` }} />
        Add {label}
      </h1>
      <ItemForm
        kind={kind}
        action={createItem.bind(null, kind)}
        submitLabel={`Add ${label}`}
      />
    </div>
  );
}

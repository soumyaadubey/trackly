import ItemForm from "@/components/ItemForm";
import { createItem } from "@/app/items/actions";
import { CompassIcon } from "@/components/icons";

export default function NewRoadmapPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-7 py-10">
      <h1 className="font-serif mb-5 flex items-center gap-2.5 text-2xl" style={{ color: "var(--ink)" }}>
        <CompassIcon size={22} style={{ color: "var(--kind-roadmap)" }} />
        Add roadmap
      </h1>
      <ItemForm
        kind="roadmap"
        action={createItem.bind(null, "roadmap")}
        submitLabel="Add roadmap"
      />
    </div>
  );
}

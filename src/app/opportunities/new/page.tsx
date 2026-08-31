import ItemForm from "@/components/ItemForm";
import { createItem } from "@/app/items/actions";
import { RocketIcon } from "@/components/icons";

export default function NewOpportunityPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-7 py-10">
      <h1 className="font-serif mb-5 flex items-center gap-2.5 text-2xl" style={{ color: "var(--ink)" }}>
        <RocketIcon size={22} style={{ color: "var(--kind-opportunity)" }} />
        Add opportunity
      </h1>
      <ItemForm
        kind="opportunity"
        action={createItem.bind(null, "opportunity")}
        submitLabel="Add opportunity"
      />
    </div>
  );
}

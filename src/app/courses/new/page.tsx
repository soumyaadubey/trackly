import ItemForm from "@/components/ItemForm";
import { createItem } from "@/app/items/actions";
import { BookIcon } from "@/components/icons";

export default function NewCoursePage() {
  return (
    <div className="mx-auto w-full max-w-xl px-7 py-10">
      <h1 className="font-serif mb-5 flex items-center gap-2.5 text-2xl" style={{ color: "var(--ink)" }}>
        <BookIcon size={22} style={{ color: "var(--kind-course)" }} />
        Add course
      </h1>
      <ItemForm
        kind="course"
        action={createItem.bind(null, "course")}
        submitLabel="Add course"
      />
    </div>
  );
}

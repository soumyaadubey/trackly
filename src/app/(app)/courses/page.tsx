import ItemsList from "@/components/items/ItemsList";

export default async function CoursesPage(props: PageProps<"/courses">) {
  const searchParams = await props.searchParams;
  return <ItemsList kind="course" searchParams={searchParams} />;
}

import ItemsList from "@/components/items/ItemsList";

export default async function RoadmapsPage(props: PageProps<"/roadmaps">) {
  const searchParams = await props.searchParams;
  return <ItemsList kind="roadmap" searchParams={searchParams} />;
}

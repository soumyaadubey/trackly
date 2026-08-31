import ItemsList from "@/components/ItemsList";

export default async function OpportunitiesPage(props: PageProps<"/opportunities">) {
  const searchParams = await props.searchParams;
  return <ItemsList kind="opportunity" searchParams={searchParams} />;
}

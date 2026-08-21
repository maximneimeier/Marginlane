import InventoryPageClient from "./InventoryPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryPage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  return <InventoryPageClient />;
}

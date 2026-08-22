import ProductionPageClient from "./ProductionPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductionPage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  return <ProductionPageClient />;
}

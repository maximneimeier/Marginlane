import ProductsPageClient from "./ProductsPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <ProductsPageClient />;
}

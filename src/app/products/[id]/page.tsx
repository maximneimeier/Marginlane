import ProductDetailPageClient from "./ProductDetailPageClient";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  await searchParams;
  return <ProductDetailPageClient id={id} />;
}

import BatchDetailPageClient from "./BatchDetailPageClient";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BatchDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  await searchParams;
  return <BatchDetailPageClient id={id} />;
}

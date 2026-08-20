import BatchDetailPageClient from "./BatchDetailPageClient";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function flagOn(value: string | string[] | undefined): boolean {
  return value === "1" || (Array.isArray(value) && value.includes("1"));
}

export default async function BatchDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <BatchDetailPageClient id={id} startEditing={flagOn(sp.edit)} />
  );
}

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
  const sp = await searchParams;
  const sell = sp.sell;
  const highlightSell =
    sell === "1" || (Array.isArray(sell) && sell.includes("1"));
  return <BatchDetailPageClient id={id} highlightSell={highlightSell} />;
}

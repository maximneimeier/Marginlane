import RevenuePageClient from "./RevenuePageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RevenuePage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <RevenuePageClient />;
}

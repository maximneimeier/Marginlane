import LogisticsPageClient from "./LogisticsPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LogisticsPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <LogisticsPageClient />;
}

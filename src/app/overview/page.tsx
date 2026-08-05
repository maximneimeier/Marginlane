import OverviewPageClient from "./OverviewPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Server page: await dynamic APIs so Client tree has no Promise props. */
export default async function OverviewPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <OverviewPageClient />;
}

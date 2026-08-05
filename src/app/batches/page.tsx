import BatchesPageClient from "./BatchesPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BatchesPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <BatchesPageClient />;
}

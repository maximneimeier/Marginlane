import DealersPageClient from "./DealersPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DealersPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <DealersPageClient />;
}

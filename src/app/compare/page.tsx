import ComparePageClient from "./ComparePageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ComparePage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <ComparePageClient />;
}

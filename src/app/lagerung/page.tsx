import LagerungPageClient from "./LagerungPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LagerungPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <LagerungPageClient />;
}

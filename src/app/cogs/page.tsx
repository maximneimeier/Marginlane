import CogsPageClient from "./CogsPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CogsPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <CogsPageClient />;
}

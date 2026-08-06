import ComponentsPageClient from "./ComponentsPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ComponentsPage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  return <ComponentsPageClient />;
}

import NewProductionPageClient from "./NewProductionPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewProductionPage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  return <NewProductionPageClient />;
}

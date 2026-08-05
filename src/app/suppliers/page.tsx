import SuppliersPageClient from "./SuppliersPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuppliersPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <SuppliersPageClient />;
}

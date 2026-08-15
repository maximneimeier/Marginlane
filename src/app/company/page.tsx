import CompanyPageClient from "./CompanyPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompanyPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <CompanyPageClient />;
}

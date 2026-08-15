import TeamsPageClient from "./TeamsPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamsPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <TeamsPageClient />;
}

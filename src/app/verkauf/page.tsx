import VerkaufPageClient from "./VerkaufPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VerkaufPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <VerkaufPageClient />;
}

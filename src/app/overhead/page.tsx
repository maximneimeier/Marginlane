import OverheadPageClient from "./OverheadPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OverheadPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <OverheadPageClient />;
}

import SalesVolumePageClient from "./SalesVolumePageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesVolumePage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  return <SalesVolumePageClient />;
}

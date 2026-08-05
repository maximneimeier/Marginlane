import SettingsPageClient from "./SettingsPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <SettingsPageClient />;
}

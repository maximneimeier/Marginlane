import ModuleChooserPageClient from "./ModuleChooserPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <ModuleChooserPageClient />;
}

import { Suspense } from "react";
import NewBatchPageClient from "./NewBatchPageClient";

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewBatchPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return (
    <Suspense
      fallback={<p className="text-sm text-muted">…</p>}
    >
      <NewBatchPageClient />
    </Suspense>
  );
}

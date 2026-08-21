"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { BatchProcurementEditor } from "@/components/BatchProcurementEditor";

export default function NewBatchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { upsertBatch } = useStore();
  const initialProductId = searchParams.get("product") ?? "";

  return (
    <BatchProcurementEditor
      mode="create"
      initialProductId={initialProductId}
      onSaved={(batch) => {
        upsertBatch(batch);
        router.push(`/batches/${batch.id}`);
      }}
      onCancel={() => router.push("/batches")}
    />
  );
}

"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { calculateResolvedEconomics } from "@/lib/resolve";
import { formatEuro, formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import {
  countBatchesByPipelineStatus,
  filterBatchesByPipeline,
  getBatchPipelineStatus,
  markBatchArrived,
  type BatchPipelineFilter,
  type BatchPipelineStatus,
} from "@/lib/batchPipeline";
import { CosterraGuidePanel } from "@/components/CosterraGuidePanel";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

const FILTERS: BatchPipelineFilter[] = [
  "all",
  "ordered",
  "in_transit",
  "arrived",
];

function statusBadgeTone(
  status: BatchPipelineStatus,
): "neutral" | "accent" | "success" {
  if (status === "arrived") return "success";
  if (status === "in_transit") return "accent";
  return "neutral";
}

function ChargenPageInner() {
  const router = useRouter();
  const { ready, data, deleteBatch, upsertBatch } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();
  const [filter, setFilter] = useState<BatchPipelineFilter>("all");

  const counts = useMemo(
    () => countBatchesByPipelineStatus(data.batches),
    [data.batches],
  );

  const visible = useMemo(
    () => filterBatchesByPipeline(data.batches, filter),
    [data.batches, filter],
  );

  if (!ready) return <p className="text-sm text-muted">{t("common.loading")}</p>;

  return (
    <div>
      <PageHeader
        title={t("batches.title")}
        description={t("batches.description")}
        action={
          <Button onClick={() => router.push("/batches/new")}>
            {t("batches.add")}
          </Button>
        }
      />

      <CosterraGuidePanel data={data} compact />

      {data.batches.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">{t("batches.empty")}</p>
          <Button
            className="mt-4"
            onClick={() => router.push("/batches/new")}
          >
            {t("batches.emptyCta")}
          </Button>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {FILTERS.map((key) => {
              const count =
                key === "all"
                  ? data.batches.length
                  : counts[key as BatchPipelineStatus];
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                    active
                      ? "border-accent/40 bg-accent-soft/50 text-foreground"
                      : "border-line bg-white text-muted hover:bg-surface-faint hover:text-foreground"
                  }`}
                >
                  {t(`batches.pipeline.${key}`)}
                  <span className="tabular-nums text-muted-soft">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
            <div className="grid grid-cols-[1.1fr_0.9fr_0.9fr_0.75fr_0.7fr_0.7fr_auto] gap-3 border-b border-line bg-surface-faint px-4 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
              <span>{t("batches.col.batch")}</span>
              <span>{t("batches.col.status")}</span>
              <span>{t("batches.col.product")}</span>
              <span>{t("batches.col.supplier")}</span>
              <span className="text-right">{t("batches.col.landed")}</span>
              <span className="text-right">{t("batches.col.margin")}</span>
              <span />
            </div>
            <ul>
              {visible.length === 0 ? (
                <li className="px-4 py-8 text-center text-[13px] text-muted">
                  {t("batches.pipeline.emptyFilter")}
                </li>
              ) : (
                visible.map((batch) => {
                  const product = data.catalogProducts.find(
                    (p) => p.id === batch.productId,
                  );
                  const supplier = data.suppliers.find(
                    (s) => s.id === batch.supplierId,
                  );
                  const econ = calculateResolvedEconomics(data, batch);
                  const status = getBatchPipelineStatus(batch);

                  return (
                    <li
                      key={batch.id}
                      className="grid grid-cols-[1.1fr_0.9fr_0.9fr_0.75fr_0.7fr_0.7fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-faint"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/batches/${batch.id}`}
                          className="font-medium text-foreground hover:text-accent"
                        >
                          {batch.label}
                        </Link>
                        <p className="text-[12px] text-muted-soft">
                          {t("batches.qty", {
                            count: formatNumber(batch.quantity, locale),
                            unit: pricingUnitLabel(
                              product?.pricingUnit ?? "pcs",
                            ),
                          })}
                        </p>
                      </div>
                      <div>
                        <Badge tone={statusBadgeTone(status)}>
                          {t(`batches.pipeline.${status}`)}
                        </Badge>
                      </div>
                      <span className="truncate text-[13px] text-muted">
                        {product?.name ?? t("common.emDash")}
                      </span>
                      <span className="truncate text-[13px] text-muted">
                        {supplier?.name ?? t("common.emDash")}
                      </span>
                      <span className="text-right text-[13px] tabular-nums">
                        {formatEuro(econ.landedCostPerUnit, locale)}
                      </span>
                      <span className="text-right text-[13px]">
                        {formatPercent(econ.contributionPercent, locale)}
                      </span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {status !== "arrived" ? (
                          <Button
                            variant="ghost"
                            className="h-7 px-2 text-[12px]"
                            onClick={() =>
                              upsertBatch(markBatchArrived(batch))
                            }
                          >
                            {t("batches.pipeline.markArrived")}
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          className="h-7 px-2 text-[12px]"
                          onClick={() => {
                            if (confirm(t("batches.deleteConfirm"))) {
                              deleteBatch(batch.id);
                            }
                          }}
                        >
                          {t("common.delete")}
                        </Button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export default function ChargenPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">…</p>}>
      <ChargenPageInner />
    </Suspense>
  );
}

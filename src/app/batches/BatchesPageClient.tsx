"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { calculateResolvedEconomics } from "@/lib/resolve";
import { formatEuro, formatNumber, formatDate } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import {
  countBatchesByPipelineStatus,
  filterBatchesByPipeline,
  getBatchPipelineStatusForData,
  type BatchPipelineFilter,
  type BatchPipelineStatus,
} from "@/lib/batchPipeline";
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
  if (status === "arrived" || status === "sold") return "success";
  if (status === "in_transit") return "accent";
  return "neutral";
}

function ChargenPageInner() {
  const router = useRouter();
  const { ready, data, deleteBatch } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();
  const [filter, setFilter] = useState<BatchPipelineFilter>("all");

  const visible = useMemo(() => {
    const open = data.batches.filter(
      (b) => getBatchPipelineStatusForData(data, b) !== "sold",
    );
    return filterBatchesByPipeline(open, filter, data);
  }, [data, filter]);

  const counts = useMemo(() => {
    const open = data.batches.filter(
      (b) => getBatchPipelineStatusForData(data, b) !== "sold",
    );
    return countBatchesByPipelineStatus(open, data);
  }, [data]);

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
                  ? Object.values(counts).reduce((a, b) => a + b, 0)
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

          <div className="overflow-x-auto rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
            <table className="w-full min-w-[780px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[11%]" />
                <col className="w-[14%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  <th className="px-4 py-2.5 font-medium">{t("batches.col.batch")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("batches.col.status")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("batches.col.product")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("batches.col.supplier")}</th>
                  <th className="px-3 py-2.5 font-medium">
                    {t("batches.col.ordered")}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t("batches.col.arrival")}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {t("batches.col.landed")}
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-[13px] text-muted"
                    >
                      {t("batches.pipeline.emptyFilter")}
                    </td>
                  </tr>
                ) : (
                  visible.map((batch) => {
                    const product = data.catalogProducts.find(
                      (p) => p.id === batch.productId,
                    );
                    const supplier = data.suppliers.find(
                      (s) => s.id === batch.supplierId,
                    );
                    const econ = calculateResolvedEconomics(data, batch);
                    const status = getBatchPipelineStatusForData(data, batch);

                    return (
                      <tr
                        key={batch.id}
                        className="border-b border-line last:border-b-0 hover:bg-surface-faint"
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-0">
                            <Link
                              href={`/batches/${batch.id}`}
                              className="block truncate font-medium text-foreground hover:text-accent"
                            >
                              {batch.label}
                            </Link>
                            <p className="truncate text-[12px] text-muted-soft">
                              {batch.poNumber
                                ? `${batch.poNumber} · `
                                : ""}
                              {t("batches.qty", {
                                count: formatNumber(batch.quantity, locale),
                                unit: pricingUnitLabel(
                                  product?.pricingUnit ?? "pcs",
                                ),
                              })}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <Badge tone={statusBadgeTone(status)}>
                            {t(`batches.pipeline.${status}`)}
                          </Badge>
                        </td>
                        <td className="truncate px-3 py-3 align-middle text-[13px] text-muted">
                          {product?.name ?? t("common.emDash")}
                        </td>
                        <td className="truncate px-3 py-3 align-middle text-[13px] text-muted">
                          {supplier?.name ?? t("common.emDash")}
                        </td>
                        <td className="px-3 py-3 align-middle text-[13px] tabular-nums text-muted">
                          {formatDate(
                            batch.orderDate || batch.createdAt,
                            locale,
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle text-[13px] tabular-nums text-muted">
                          {batch.arrivalDate
                            ? formatDate(batch.arrivalDate, locale)
                            : batch.expectedArrivalDate
                              ? formatDate(batch.expectedArrivalDate, locale)
                              : t("common.emDash")}
                        </td>
                        <td className="px-3 py-3 text-right align-middle text-[13px] tabular-nums font-medium">
                          {formatEuro(econ.landedCostPerUnit, locale)}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex justify-end gap-0.5">
                            <Link
                              href={`/batches/${batch.id}?edit=1`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                              title={t("common.edit")}
                              aria-label={t("common.edit")}
                            >
                              <Pencil size={15} strokeWidth={1.75} aria-hidden />
                            </Link>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                              title={t("common.delete")}
                              aria-label={t("common.delete")}
                              onClick={() => {
                                if (
                                  window.confirm(t("batches.deleteConfirm"))
                                ) {
                                  deleteBatch(batch.id);
                                }
                              }}
                            >
                              <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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

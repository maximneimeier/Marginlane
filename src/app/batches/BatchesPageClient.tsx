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

function paymentDelayDays(paymentDays: number, paymentUnit: string): number {
  const n = Math.max(paymentDays, 0);
  return paymentUnit === "Wochen" ? n * 7 : n;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ChargenPageInner() {
  const router = useRouter();
  const { ready, data, deleteBatch } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();
  const [filter, setFilter] = useState<BatchPipelineFilter>("all");

  const openBatches = useMemo(
    () =>
      data.batches.filter(
        (b) => getBatchPipelineStatusForData(data, b) !== "sold",
      ),
    [data],
  );

  const visible = useMemo(
    () => filterBatchesByPipeline(openBatches, filter, data),
    [openBatches, filter, data],
  );

  const counts = useMemo(
    () => countBatchesByPipelineStatus(openBatches, data),
    [openBatches, data],
  );

  const kpis = useMemo(() => {
    let capitalTied = 0;
    let stockValue = 0;
    let nextDue: { date: string; amount: number; label: string } | null = null;

    for (const batch of openBatches) {
      const status = getBatchPipelineStatusForData(data, batch);
      const econ = calculateResolvedEconomics(data, batch);
      const total = econ.landedCostPerUnit * batch.quantity;

      if (status === "ordered" || status === "in_transit") {
        capitalTied += total;
        const orderIso = (batch.orderDate || batch.createdAt || "").slice(0, 10);
        if (orderIso) {
          const due = addDaysIso(
            orderIso,
            paymentDelayDays(
              econ.commercial.paymentDays,
              econ.commercial.paymentUnit,
            ),
          );
          if (!nextDue || due < nextDue.date) {
            nextDue = { date: due, amount: total, label: batch.label };
          }
        }
      } else if (status === "arrived") {
        stockValue += total;
      }
    }

    return { capitalTied, stockValue, nextDue, openCount: openBatches.length };
  }, [openBatches, data]);

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
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="!p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                {t("batches.kpi.capital")}
              </p>
              <p className="mt-1 text-lg tabular-nums font-semibold text-foreground">
                {formatEuro(kpis.capitalTied, locale)}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                {t("batches.kpi.capitalHint")}
              </p>
            </Card>
            <Card className="!p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                {t("batches.kpi.stock")}
              </p>
              <p className="mt-1 text-lg tabular-nums font-semibold text-foreground">
                {formatEuro(kpis.stockValue, locale)}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                {t("batches.kpi.stockHint")}
              </p>
            </Card>
            <Card className="!p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                {t("batches.kpi.nextDue")}
              </p>
              {kpis.nextDue ? (
                <>
                  <p className="mt-1 text-lg tabular-nums font-semibold text-foreground">
                    {formatDate(kpis.nextDue.date, locale)}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">
                    {formatEuro(kpis.nextDue.amount, locale)} ·{" "}
                    {kpis.nextDue.label}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-lg text-muted">{t("common.emDash")}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {t("batches.kpi.nextDueEmpty")}
                  </p>
                </>
              )}
            </Card>
            <Card className="!p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                {t("batches.kpi.open")}
              </p>
              <p className="mt-1 text-lg tabular-nums font-semibold text-foreground">
                {formatNumber(kpis.openCount, locale)}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                <Link href="/compare" className="text-accent hover:underline">
                  {t("batches.kpi.compareLink")}
                </Link>
              </p>
            </Card>
          </div>

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
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[12%]" />
                <col className="w-[22%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  <th className="px-4 py-2.5 font-medium">
                    {t("batches.col.batch")}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t("batches.col.status")}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t("batches.col.productSupplier")}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t("batches.col.dates")}
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
                      colSpan={6}
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
                    const landedTotal =
                      econ.landedCostPerUnit * batch.quantity;

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
                        <td className="px-3 py-3 align-middle">
                          <p className="truncate text-[13px] text-foreground">
                            {product?.name ?? t("common.emDash")}
                          </p>
                          <p className="truncate text-[12px] text-muted-soft">
                            {supplier?.name ?? t("common.emDash")}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-middle text-[12px] tabular-nums text-muted">
                          <p>
                            <span className="text-muted-soft">
                              {t("batches.col.ordered")}:{" "}
                            </span>
                            {formatDate(
                              batch.orderDate || batch.createdAt,
                              locale,
                            )}
                          </p>
                          <p>
                            <span className="text-muted-soft">
                              {t("batches.col.arrival")}:{" "}
                            </span>
                            {batch.arrivalDate
                              ? formatDate(batch.arrivalDate, locale)
                              : batch.expectedArrivalDate
                                ? formatDate(
                                    batch.expectedArrivalDate,
                                    locale,
                                  )
                                : t("common.emDash")}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right align-middle">
                          <p className="text-[13px] tabular-nums font-medium text-foreground">
                            {formatEuro(econ.landedCostPerUnit, locale)}
                            <span className="ml-1 text-[11px] font-normal text-muted-soft">
                              / {pricingUnitLabel(product?.pricingUnit ?? "pcs")}
                            </span>
                          </p>
                          <p className="text-[12px] tabular-nums text-muted">
                            {formatEuro(landedTotal, locale)}{" "}
                            <span className="text-muted-soft">
                              {t("batchNew.batchTotalShort")}
                            </span>
                          </p>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex justify-end gap-0.5">
                            <Link
                              href={`/batches/${batch.id}?edit=1`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
                              title={t("common.edit")}
                              aria-label={t("common.edit")}
                            >
                              <Pencil
                                size={15}
                                strokeWidth={1.75}
                                aria-hidden
                              />
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
                              <Trash2
                                size={15}
                                strokeWidth={1.75}
                                aria-hidden
                              />
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

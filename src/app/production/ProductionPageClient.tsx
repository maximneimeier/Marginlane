"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import {
  checkProductionStock,
  estimateProductionRun,
} from "@/lib/production";
import { formatEuro, formatNumber } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import type { ProductionRunStatus } from "@/lib/types";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

type StatusFilter = "all" | ProductionRunStatus;

function tone(
  status: ProductionRunStatus,
): "neutral" | "accent" | "success" {
  if (status === "done") return "success";
  if (status === "planned") return "accent";
  return "neutral";
}

export default function ProductionPageClient() {
  const router = useRouter();
  const {
    ready,
    data,
    deleteProductionRun,
    completeProductionRunInStore,
  } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();
  const [filter, setFilter] = useState<StatusFilter>("all");

  const runs = useMemo(() => {
    const list = [...(data.productionRuns ?? [])].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return list
      .filter((run) => (filter === "all" ? true : run.status === filter))
      .map((run) => {
        const product = data.catalogProducts.find(
          (p) => p.id === run.outputProductId,
        );
        const estimate = estimateProductionRun(data, run);
        const stock = checkProductionStock(data, run);
        return { run, product, estimate, stock };
      });
  }, [data, filter]);

  const kpis = useMemo(() => {
    const all = data.productionRuns ?? [];
    const planned = all.filter((r) => r.status === "planned");
    let plannedValue = 0;
    let wipShortfalls = 0;
    for (const run of planned) {
      plannedValue += estimateProductionRun(data, run).totalCost;
      if (checkProductionStock(data, run).hasShortfall) wipShortfalls += 1;
    }
    const done = all.filter((r) => r.status === "done").length;
    return {
      planned: planned.length,
      plannedValue,
      wipShortfalls,
      done,
    };
  }, [data]);

  if (!ready) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }

  const filters: StatusFilter[] = ["all", "planned", "done", "cancelled"];

  return (
    <div>
      <PageHeader
        title={t("production.page.title")}
        description={t("production.page.description")}
        action={
          <Link
            href="/production/new"
            className="inline-flex h-8 items-center rounded-[8px] bg-accent px-3 text-[13px] font-medium text-white hover:opacity-90"
          >
            {t("production.add")}
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <p className="text-[11px] uppercase tracking-[0.04em] text-muted-soft">
            {t("production.kpi.planned")}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {kpis.planned}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase tracking-[0.04em] text-muted-soft">
            {t("production.kpi.plannedValue")}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatEuro(kpis.plannedValue, locale)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-soft">
            {t("production.kpi.wipHint")}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase tracking-[0.04em] text-muted-soft">
            {t("production.kpi.stock")}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {kpis.wipShortfalls > 0
              ? t("production.kpi.shortfall", { count: String(kpis.wipShortfalls) })
              : t("production.kpi.stockOk")}
          </p>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {filters.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-[8px] px-2.5 py-1 text-[12px] ${
              filter === key
                ? "bg-surface-soft font-medium text-foreground"
                : "text-muted hover:bg-white/70"
            }`}
          >
            {t(`production.filter.${key}`)}
          </button>
        ))}
      </div>

      {runs.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted">{t("production.empty")}</p>
          <Link
            href="/production/new"
            className="mt-3 inline-flex h-8 items-center rounded-[8px] bg-accent px-3 text-[13px] font-medium text-white hover:opacity-90"
          >
            {t("production.emptyCta")}
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="border-b border-line bg-surface-faint text-[11px] uppercase tracking-[0.04em] text-muted-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t("production.col.run")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("production.col.product")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("production.col.qty")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("production.col.unitCost")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("production.col.stock")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("production.col.status")}
                  </th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {runs.map(({ run, product, estimate, stock }) => (
                  <tr key={run.id} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-foreground">
                        {run.label || t("production.untitled")}
                      </p>
                      <p className="text-[11px] text-muted-soft">
                        {new Date(run.createdAt).toLocaleDateString(locale)}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      {product?.name ?? t("common.emDash")}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(run.outputQuantity, locale)}{" "}
                      {pricingUnitLabel(product?.pricingUnit ?? "pcs")}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatEuro(estimate.unitCost, locale)}
                    </td>
                    <td className="px-3 py-2.5">
                      {run.status !== "planned" ? (
                        <span className="text-muted-soft">
                          {t("common.emDash")}
                        </span>
                      ) : stock.hasShortfall ? (
                        <Badge tone="neutral">
                          {t("production.stock.short")}
                        </Badge>
                      ) : stock.allUntracked ? (
                        <Badge tone="neutral">
                          {t("production.stock.untracked")}
                        </Badge>
                      ) : (
                        <Badge tone="success">
                          {t("production.stock.ok")}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={tone(run.status)}>
                        {t(`production.status.${run.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {run.status === "planned" ? (
                          <Button
                            type="button"
                            variant="primary"
                            className="h-7 px-2 text-[12px]"
                            disabled={stock.hasShortfall}
                            title={
                              stock.hasShortfall
                                ? t("production.stock.blockComplete")
                                : undefined
                            }
                            onClick={() => {
                              if (completeProductionRunInStore(run.id)) {
                                router.refresh();
                              }
                            }}
                          >
                            {t("production.complete")}
                          </Button>
                        ) : null}
                        {run.outputBatchId ? (
                          <Link
                            href={`/batches/${run.outputBatchId}`}
                            className="inline-flex h-7 items-center rounded-[8px] border border-line px-2 text-[12px] font-medium hover:bg-surface-faint"
                          >
                            {t("production.openBatch")}
                          </Link>
                        ) : null}
                        {run.status !== "done" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-7 px-2 text-[12px] text-muted"
                            onClick={() => {
                              if (
                                window.confirm(t("production.deleteConfirm"))
                              ) {
                                deleteProductionRun(run.id);
                              }
                            }}
                          >
                            {t("common.delete")}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

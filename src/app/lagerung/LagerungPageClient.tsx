"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { calculateResolvedEconomics } from "@/lib/resolve";
import {
  getBatchPipelineStatusForData,
  markBatchArrived,
  setBatchExpectedArrival,
  type BatchPipelineStatus,
} from "@/lib/batchPipeline";
import { formatEuro, formatNumber } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import {
  defaultOverviewRange,
  rangeForPreset,
  type DatePreset,
  type DateRange,
} from "@/lib/overview";
import { OverviewOverheadPanel } from "@/components/OverviewOverheadPanel";
import { Badge, Button, Card, Field, PageHeader, Select, TextInput } from "@/components/ui";

type StockFilter = "all" | "ordered" | "in_transit" | "arrived";

function toneForStatus(
  status: BatchPipelineStatus,
): "neutral" | "accent" | "success" {
  if (status === "arrived") return "success";
  if (status === "in_transit") return "accent";
  return "neutral";
}

export default function LagerungPageClient() {
  const { ready, data, upsertBatch } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();
  const [filter, setFilter] = useState<StockFilter>("all");
  const [showOverhead, setShowOverhead] = useState(false);
  const [preset, setPreset] = useState<DatePreset>("this_year");
  const [range, setRange] = useState<DateRange>(() => defaultOverviewRange());
  const [etaDraft, setEtaDraft] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    return data.batches
      .map((batch) => {
        const product = data.catalogProducts.find((p) => p.id === batch.productId);
        const supplier = data.suppliers.find((s) => s.id === batch.supplierId);
        const econ = calculateResolvedEconomics(data, batch);
        const status = getBatchPipelineStatusForData(data, batch);
        return { batch, product, supplier, econ, status };
      })
      .filter(({ status }) => status !== "sold")
      .filter(({ status }) => (filter === "all" ? true : status === filter))
      .sort((a, b) => {
        const order = { ordered: 0, in_transit: 1, arrived: 2, sold: 3 };
        return order[a.status] - order[b.status];
      });
  }, [data, filter]);

  const summary = useMemo(() => {
    let inStockUnits = 0;
    let inTransitUnits = 0;
    let orderedUnits = 0;
    let inStockBatches = 0;
    for (const batch of data.batches) {
      const status = getBatchPipelineStatusForData(data, batch);
      const econ = calculateResolvedEconomics(data, batch);
      if (status === "arrived") {
        inStockUnits += econ.remainingQuantity;
        inStockBatches += 1;
      } else if (status === "in_transit") {
        inTransitUnits += batch.quantity;
      } else if (status === "ordered") {
        orderedUnits += batch.quantity;
      }
    }
    return { inStockUnits, inTransitUnits, orderedUnits, inStockBatches };
  }, [data]);

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  function applyPreset(next: DatePreset) {
    setPreset(next);
    if (next !== "custom") setRange(rangeForPreset(next));
  }

  function updateRange(partial: Partial<DateRange>) {
    setPreset("custom");
    setRange((prev) => ({ ...prev, ...partial }));
  }

  const filters: StockFilter[] = ["all", "ordered", "in_transit", "arrived"];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("lagerung.page.title")}
        description={t("lagerung.page.description")}
        action={
          <Link
            href="/batches/new"
            className="inline-flex h-8 items-center rounded-[8px] bg-accent px-3 text-[13px] font-medium text-white hover:opacity-90"
          >
            {t("nav.newBatch")}
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="!p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-soft">
            {t("lagerung.kpi.inStock")}
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums">
            {formatNumber(summary.inStockUnits, locale)}
          </p>
          <p className="text-[12px] text-muted">
            {t("lagerung.kpi.batches", {
              count: String(summary.inStockBatches),
            })}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-soft">
            {t("lagerung.kpi.inTransit")}
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums">
            {formatNumber(summary.inTransitUnits, locale)}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-soft">
            {t("lagerung.kpi.ordered")}
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums">
            {formatNumber(summary.orderedUnits, locale)}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((key) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`inline-flex items-center rounded-[8px] border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                active
                  ? "border-accent/40 bg-accent-soft/50 text-foreground"
                  : "border-line bg-white text-muted hover:bg-surface-faint hover:text-foreground"
              }`}
            >
              {t(`lagerung.filter.${key}`)}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">{t("lagerung.stock.empty")}</p>
          <Link
            href="/batches"
            className="mt-4 inline-flex h-8 items-center rounded-[8px] border border-line px-3 text-[13px] font-medium hover:bg-surface-faint"
          >
            {t("lagerung.stock.toBatches")}
          </Link>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-[1.1fr_0.8fr_0.9fr_0.7fr_0.7fr_0.8fr_auto] gap-3 border-b border-line bg-surface-faint px-4 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
            <span>{t("batches.col.batch")}</span>
            <span>{t("batches.col.status")}</span>
            <span>{t("batches.col.product")}</span>
            <span className="text-right">{t("lagerung.col.onHand")}</span>
            <span className="text-right">{t("lagerung.col.arrival")}</span>
            <span className="text-right">{t("batches.col.landed")}</span>
            <span />
          </div>
          <ul>
            {rows.map(({ batch, product, supplier, econ, status }) => {
              const unit = pricingUnitLabel(product?.pricingUnit ?? "pcs");
              const onHand =
                status === "arrived"
                  ? econ.remainingQuantity
                  : status === "in_transit" || status === "ordered"
                    ? batch.quantity
                    : 0;
              return (
                <li
                  key={batch.id}
                  className="grid grid-cols-[1.1fr_0.8fr_0.9fr_0.7fr_0.7fr_0.8fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-faint"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/batches/${batch.id}`}
                      className="font-medium text-foreground hover:text-accent"
                    >
                      {batch.label}
                    </Link>
                    <p className="truncate text-[12px] text-muted-soft">
                      {supplier?.name ?? t("common.emDash")}
                    </p>
                  </div>
                  <Badge tone={toneForStatus(status)}>
                    {t(`batches.pipeline.${status}`)}
                  </Badge>
                  <span className="truncate text-[13px] text-muted">
                    {product?.name ?? t("common.emDash")}
                  </span>
                  <span className="text-right text-[13px] tabular-nums">
                    {formatNumber(onHand, locale)}{" "}
                    <span className="text-muted-soft">{unit}</span>
                  </span>
                  <span className="text-right text-[13px] tabular-nums text-muted">
                    {batch.arrivalDate?.slice(0, 10) || t("common.emDash")}
                  </span>
                  <span className="text-right text-[13px] tabular-nums">
                    {formatEuro(econ.landedCostPerUnit, locale)}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {status === "ordered" ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          className="h-7 rounded-[6px] border border-line bg-white px-1.5 text-[11px]"
                          value={etaDraft[batch.id] ?? ""}
                          onChange={(e) =>
                            setEtaDraft((prev) => ({
                              ...prev,
                              [batch.id]: e.target.value,
                            }))
                          }
                          aria-label={t("lagerung.action.setEta")}
                        />
                        <Button
                          variant="ghost"
                          className="h-7 px-2 text-[12px]"
                          disabled={!etaDraft[batch.id]}
                          onClick={() => {
                            const eta = etaDraft[batch.id];
                            if (!eta) return;
                            upsertBatch(setBatchExpectedArrival(batch, eta));
                          }}
                        >
                          {t("lagerung.action.setEta")}
                        </Button>
                      </div>
                    ) : null}
                    {status !== "arrived" ? (
                      <Button
                        variant="ghost"
                        className="h-7 px-2 text-[12px]"
                        onClick={() => upsertBatch(markBatchArrived(batch))}
                      >
                        {t("batches.pipeline.markArrived")}
                      </Button>
                    ) : (
                      <Link
                        href={`/batches/${batch.id}?sell=1`}
                        className="inline-flex h-7 items-center rounded-[8px] px-2 text-[12px] font-medium text-accent hover:underline"
                      >
                        {t("lagerung.action.sell")}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setShowOverhead((v) => !v)}
          className="text-[13px] font-medium text-muted hover:text-foreground"
        >
          {showOverhead
            ? t("lagerung.overhead.hide")
            : t("lagerung.overhead.show")}
        </button>
        {showOverhead ? (
          <div className="mt-4 space-y-4">
            <p className="text-[13px] text-muted">
              {t("lagerung.page.hint")}{" "}
              <Link href="/logistics" className="text-accent hover:underline">
                {t("nav.logistics")}
              </Link>
              .
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("overviewPage.from")}>
                <TextInput
                  type="date"
                  value={range.from}
                  onChange={(e) => updateRange({ from: e.target.value })}
                />
              </Field>
              <Field label={t("overviewPage.to")}>
                <TextInput
                  type="date"
                  value={range.to}
                  onChange={(e) => updateRange({ to: e.target.value })}
                />
              </Field>
              <Field label={t("overviewPage.preset")}>
                <Select
                  value={preset}
                  onChange={(e) => applyPreset(e.target.value as DatePreset)}
                >
                  <option value="this_year">
                    {t("overviewPage.preset.thisYear")}
                  </option>
                  <option value="last_quarter">
                    {t("overviewPage.preset.lastQuarter")}
                  </option>
                  <option value="last_12">
                    {t("overviewPage.preset.last12")}
                  </option>
                  <option value="custom">
                    {t("overviewPage.preset.custom")}
                  </option>
                </Select>
              </Field>
            </div>
            <OverviewOverheadPanel
              range={range}
              hidePageHeader
              section="positions"
              simpleMode
              categoryFilter="lagerungsgemeinkosten"
              defaultAllocation="nach_stueckzahl"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

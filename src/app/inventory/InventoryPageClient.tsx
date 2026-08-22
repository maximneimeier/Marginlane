"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { calculateResolvedEconomics } from "@/lib/resolve";
import {
  getBatchPipelineStatusForData,
  isFinishedGoodsBatch,
  isPartBatch,
  markBatchArrived,
  setBatchExpectedArrival,
  type BatchPipelineStatus,
} from "@/lib/batchPipeline";
import type { InventoryStockScope } from "@/lib/inventoryOverview";
import { formatEuro, formatNumber } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { InventoryOverviewPanel } from "@/components/InventoryOverviewPanel";
import {
  Badge,
  Button,
  Card,
  PageHeader,
} from "@/components/ui";
import type { AppData, CatalogProduct } from "@/lib/types";

type PageTab = "overview" | "stock" | "arrivals";
type StockFilter = "all" | "ordered" | "in_transit" | "arrived";
type ProductSort = "product" | "value";
type SortDir = "asc" | "desc";

type ProductStockRow = {
  productId: string;
  product: CatalogProduct | undefined;
  name: string;
  orderedQty: number;
  inTransitQty: number;
  inStockQty: number;
  openQty: number;
  /** Lagerwert nur physisch im Lager (Rest × Landed). */
  stockValue: number;
  /** Wert aller offenen Mengen (bestellt + unterwegs + Lager). */
  openValue: number;
  batchCount: number;
  avgLanded: number;
};

function toneForStatus(
  status: BatchPipelineStatus,
): "neutral" | "accent" | "success" {
  if (status === "arrived") return "success";
  if (status === "in_transit") return "accent";
  return "neutral";
}

function buildProductStock(
  data: AppData,
  scope: InventoryStockScope,
): ProductStockRow[] {
  const map = new Map<string, ProductStockRow>();

  for (const batch of data.batches) {
    if (scope === "parts" ? !isPartBatch(data, batch) : !isFinishedGoodsBatch(data, batch)) {
      continue;
    }

    const status = getBatchPipelineStatusForData(data, batch);
    if (status === "sold") continue;

    const econ = calculateResolvedEconomics(data, batch);
    const product = data.catalogProducts.find((p) => p.id === batch.productId);
    const key = batch.productId || "__none__";
    let row = map.get(key);
    if (!row) {
      row = {
        productId: key,
        product,
        name: product?.name ?? "—",
        orderedQty: 0,
        inTransitQty: 0,
        inStockQty: 0,
        openQty: 0,
        stockValue: 0,
        openValue: 0,
        batchCount: 0,
        avgLanded: 0,
      };
      map.set(key, row);
    }

    const landed = econ.landedCostPerUnit;
    row.batchCount += 1;

    if (status === "ordered") {
      row.orderedQty += batch.quantity;
      row.openQty += batch.quantity;
      row.openValue += batch.quantity * landed;
    } else if (status === "in_transit") {
      row.inTransitQty += batch.quantity;
      row.openQty += batch.quantity;
      row.openValue += batch.quantity * landed;
    } else if (status === "arrived") {
      const qty = econ.remainingQuantity;
      row.inStockQty += qty;
      row.openQty += qty;
      row.stockValue += qty * landed;
      row.openValue += qty * landed;
    }
  }

  return [...map.values()].map((row) => ({
    ...row,
    avgLanded: row.openQty > 0 ? row.openValue / row.openQty : 0,
  }));
}

export default function InventoryPageClient() {
  const { ready, data, upsertBatch } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();
  const [scope, setScope] = useState<InventoryStockScope>("finished");
  const [tab, setTab] = useState<PageTab>("overview");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [productSort, setProductSort] = useState<ProductSort>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [etaDraft, setEtaDraft] = useState<Record<string, string>>({});

  const arrivalRows = useMemo(() => {
    return data.batches
      .filter((batch) =>
        scope === "parts"
          ? isPartBatch(data, batch)
          : isFinishedGoodsBatch(data, batch),
      )
      .map((batch) => {
        const product = data.catalogProducts.find(
          (p) => p.id === batch.productId,
        );
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
  }, [data, filter, scope]);

  const productRows = useMemo(() => {
    const rows = buildProductStock(data, scope);
    const dir = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      if (productSort === "product") {
        return a.name.localeCompare(b.name, locale) * dir;
      }
      const byValue = (a.stockValue - b.stockValue) * dir;
      if (byValue !== 0) return byValue;
      return a.name.localeCompare(b.name, locale);
    });
  }, [data, productSort, sortDir, locale, scope]);

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  function toggleSort(next: ProductSort) {
    if (productSort === next) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setProductSort(next);
      setSortDir(next === "value" ? "desc" : "asc");
    }
  }

  const scopes: InventoryStockScope[] = ["finished", "parts"];
  const tabs: PageTab[] = ["overview", "stock", "arrivals"];
  const filters: StockFilter[] = ["all", "ordered", "in_transit", "arrived"];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("lagerung.page.title")}
        description={t("lagerung.page.description")}
        action={
          <Link
            href="/batches/new"
            className="inline-flex h-8 items-center rounded-[8px] border border-line bg-white px-3 text-[13px] font-medium text-foreground hover:bg-surface-faint"
          >
            {t("nav.newBatch")}
          </Link>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {scopes.map((key) => {
          const active = scope === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key)}
              className={`inline-flex items-center rounded-[8px] border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "border-accent/40 bg-accent-soft/50 text-foreground"
                  : "border-line bg-white text-muted hover:bg-surface-faint hover:text-foreground"
              }`}
            >
              {t(`lagerung.scope.${key}`)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-line pb-3">
        {tabs.map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-foreground text-white"
                  : "text-muted hover:bg-surface-faint hover:text-foreground"
              }`}
            >
              {t(`lagerung.tab.${key}`)}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <InventoryOverviewPanel data={data} scope={scope} />
      ) : null}

      {tab === "stock" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-muted">{t("lagerung.sort.label")}</span>
            <button
              type="button"
              onClick={() => toggleSort("product")}
              className={`inline-flex items-center rounded-[8px] border px-2.5 py-1.5 text-[12px] font-medium ${
                productSort === "product"
                  ? "border-accent/40 bg-accent-soft/50 text-foreground"
                  : "border-line bg-white text-muted"
              }`}
            >
              {scope === "parts"
                ? t("lagerung.sort.part")
                : t("lagerung.sort.product")}
              {productSort === "product"
                ? sortDir === "asc"
                  ? " ↑"
                  : " ↓"
                : ""}
            </button>
            <button
              type="button"
              onClick={() => toggleSort("value")}
              className={`inline-flex items-center rounded-[8px] border px-2.5 py-1.5 text-[12px] font-medium ${
                productSort === "value"
                  ? "border-accent/40 bg-accent-soft/50 text-foreground"
                  : "border-line bg-white text-muted"
              }`}
            >
              {t("lagerung.sort.value")}
              {productSort === "value"
                ? sortDir === "asc"
                  ? " ↑"
                  : " ↓"
                : ""}
            </button>
          </div>

          {productRows.length === 0 ? (
            <Card>
              <p className="text-[13px] text-muted">
                {scope === "parts"
                  ? t("lagerung.stock.emptyParts")
                  : t("lagerung.stock.empty")}
              </p>
              <Link
                href="/batches"
                className="mt-4 inline-flex h-8 items-center rounded-[8px] border border-line px-3 text-[13px] font-medium hover:bg-surface-faint"
              >
                {t("lagerung.stock.toBatches")}
              </Link>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
              <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    <th className="px-4 py-2.5 font-medium">
                      <button
                        type="button"
                        className="text-left hover:text-foreground"
                        onClick={() => toggleSort("product")}
                      >
                        {scope === "parts"
                          ? t("lagerung.col.part")
                          : t("batches.col.product")}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      {t("lagerung.col.ordered")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      {t("lagerung.col.inTransit")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      {t("lagerung.col.onHand")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      <button
                        type="button"
                        className="hover:text-foreground"
                        onClick={() => toggleSort("value")}
                      >
                        {t("lagerung.col.stockValue")}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {t("lagerung.col.avgLanded")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((row) => {
                    const unit = pricingUnitLabel(
                      row.product?.pricingUnit ?? "pcs",
                    );
                    return (
                      <tr
                        key={row.productId}
                        className="border-b border-line last:border-b-0 hover:bg-surface-faint"
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-0">
                            <Link
                              href={
                                row.productId !== "__none__"
                                  ? `/products/${row.productId}`
                                  : "/products"
                              }
                              className="block truncate font-medium text-foreground hover:text-accent"
                            >
                              {row.name}
                            </Link>
                            <p className="text-[12px] text-muted-soft">
                              {t("lagerung.kpi.batches", {
                                count: String(row.batchCount),
                              })}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right align-middle text-[13px] tabular-nums">
                          {formatNumber(row.orderedQty, locale)}
                        </td>
                        <td className="px-3 py-3 text-right align-middle text-[13px] tabular-nums">
                          {formatNumber(row.inTransitQty, locale)}
                        </td>
                        <td className="px-3 py-3 text-right align-middle text-[13px] tabular-nums">
                          {formatNumber(row.inStockQty, locale)}{" "}
                          <span className="text-muted-soft">{unit}</span>
                        </td>
                        <td className="px-3 py-3 text-right align-middle text-[13px] tabular-nums font-medium">
                          {formatEuro(row.stockValue, locale)}
                        </td>
                        <td className="px-4 py-3 text-right align-middle text-[13px] tabular-nums text-muted">
                          {formatEuro(row.avgLanded, locale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {tab === "arrivals" ? (
        <>
          <p className="rounded-[8px] border border-line bg-surface-faint px-3 py-2 text-[12px] text-muted">
            {scope === "parts"
              ? t("inventory.arrivals.hintParts")
              : t("inventory.arrivals.hint")}
          </p>
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

          {arrivalRows.length === 0 ? (
            <Card>
              <p className="text-[13px] text-muted">
                {scope === "parts"
                  ? t("lagerung.stock.emptyParts")
                  : t("lagerung.stock.empty")}
              </p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[11%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[25%]" />
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
                      {scope === "parts"
                        ? t("lagerung.col.part")
                        : t("batches.col.product")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      {t("lagerung.col.onHand")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      {t("lagerung.col.arrival")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      {t("batches.col.landed")}
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {t("inventory.col.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {arrivalRows.map(
                    ({ batch, product, supplier, econ, status }) => {
                      const unit = pricingUnitLabel(
                        product?.pricingUnit ?? "pcs",
                      );
                      const onHand =
                        status === "arrived"
                          ? econ.remainingQuantity
                          : status === "in_transit" || status === "ordered"
                            ? batch.quantity
                            : 0;
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
                                {supplier?.name ?? t("common.emDash")}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <Badge tone={toneForStatus(status)}>
                              {t(`batches.pipeline.${status}`)}
                            </Badge>
                          </td>
                          <td className="truncate px-3 py-3 align-middle text-[13px] text-muted">
                            {product?.name ?? t("common.emDash")}
                          </td>
                          <td className="px-3 py-3 text-right align-middle text-[13px] tabular-nums">
                            {formatNumber(onHand, locale)}{" "}
                            <span className="text-muted-soft">{unit}</span>
                          </td>
                          <td className="px-3 py-3 text-right align-middle text-[13px] tabular-nums text-muted">
                            {batch.arrivalDate?.slice(0, 10) ||
                              batch.expectedArrivalDate?.slice(0, 10) ||
                              t("common.emDash")}
                          </td>
                          <td className="px-3 py-3 text-right align-middle text-[13px] tabular-nums">
                            {formatEuro(econ.landedCostPerUnit, locale)}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-nowrap items-center justify-end gap-1">
                              {status === "ordered" ? (
                                <>
                                  <input
                                    type="date"
                                    className="h-7 w-[8.5rem] shrink-0 rounded-[6px] border border-line bg-white px-1.5 text-[11px]"
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
                                    className="h-7 shrink-0 px-2 text-[12px]"
                                    disabled={!etaDraft[batch.id]}
                                    onClick={() => {
                                      const eta = etaDraft[batch.id];
                                      if (!eta) return;
                                      upsertBatch(
                                        setBatchExpectedArrival(batch, eta),
                                      );
                                    }}
                                  >
                                    {t("lagerung.action.setEta")}
                                  </Button>
                                </>
                              ) : null}
                              {status !== "arrived" ? (
                                <Button
                                  variant="ghost"
                                  className="h-7 shrink-0 px-2 text-[12px]"
                                  onClick={() =>
                                    upsertBatch(markBatchArrived(batch))
                                  }
                                >
                                  {t("batches.pipeline.markArrived")}
                                </Button>
                              ) : scope === "finished" ? (
                                <Link
                                  href={`/batches/${batch.id}?sell=1`}
                                  className="inline-flex h-7 shrink-0 items-center rounded-[8px] px-2 text-[12px] font-medium text-accent hover:underline"
                                >
                                  {t("lagerung.action.sell")}
                                </Link>
                              ) : (
                                <Link
                                  href="/production"
                                  className="inline-flex h-7 shrink-0 items-center rounded-[8px] px-2 text-[12px] font-medium text-accent hover:underline"
                                >
                                  {t("lagerung.action.toProduction")}
                                </Link>
                              )}
                              <Link
                                href={`/batches/${batch.id}?edit=1`}
                                className="inline-flex h-7 shrink-0 items-center rounded-[8px] px-2 text-[12px] font-medium text-muted hover:text-foreground hover:underline"
                                title={t("inventory.arrivals.adjustCosts")}
                              >
                                {t("inventory.arrivals.adjustCosts")}
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

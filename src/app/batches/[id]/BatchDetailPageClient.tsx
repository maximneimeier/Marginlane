"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { emptyBatchDuty } from "@/lib/types";
import { formatEuro, formatMoney, formatDate } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import {
  calculateResolvedEconomics,
  resolveUnitPurchasePrice,
} from "@/lib/resolve";
import { resolveFxContext } from "@/lib/fx";
import { WaterfallChart } from "@/components/WaterfallChart";
import { BatchProcurementEditor } from "@/components/BatchProcurementEditor";
import { getBatchPipelineStatusForData } from "@/lib/batchPipeline";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

export default function ChargeDetailPage({
  id,
  startEditing = false,
}: {
  id: string;
  startEditing?: boolean;
}) {
  const router = useRouter();
  const { ready, data, upsertBatch, deleteBatch } = useStore();
  const { t, allocationLabel, locale, pricingUnitLabel } = useI18n();
  const stored = data.batches.find((b) => b.id === id);
  const [editing, setEditing] = useState(startEditing);
  const [editBootstrapped, setEditBootstrapped] = useState(false);

  useEffect(() => {
    if (!ready || !stored || !startEditing || editBootstrapped) return;
    setEditing(true);
    setEditBootstrapped(true);
  }, [ready, stored, startEditing, editBootstrapped]);

  if (!ready) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!stored) {
    return (
      <main>
        <p className="text-sm text-muted">{t("batchDetail.notFound")}</p>
        <Link href="/batches" className="mt-3 inline-block text-sm text-accent">
          {t("common.back")}
        </Link>
      </main>
    );
  }

  if (editing) {
    return (
      <BatchProcurementEditor
        mode="edit"
        initialBatch={{
          ...structuredClone(stored),
          duty: stored.duty ?? emptyBatchDuty(),
          quotes: stored.quotes ?? [],
          activeQuoteId: stored.activeQuoteId ?? null,
        }}
        onSaved={(batch) => {
          upsertBatch(batch);
          setEditing(false);
          router.replace(`/batches/${batch.id}`);
        }}
        onCancel={() => {
          setEditing(false);
          router.replace(`/batches/${stored.id}`);
        }}
      />
    );
  }

  const catalogProduct = data.catalogProducts.find(
    (p) => p.id === stored.productId,
  );
  const supplier = data.suppliers.find((s) => s.id === stored.supplierId);
  const unit = catalogProduct
    ? pricingUnitLabel(catalogProduct.pricingUnit)
    : pricingUnitLabel("pcs");
  const econ = calculateResolvedEconomics(data, stored);
  const pipelineStatus = getBatchPipelineStatusForData(data, stored);
  const landedIdx = econ.waterfall.findIndex((s) => s.id === "landed");
  const landedWaterfall =
    landedIdx >= 0
      ? econ.waterfall.slice(0, landedIdx + 1)
      : econ.waterfall.filter(
          (s) =>
            s.kind === "base" || s.kind === "cost" || s.kind === "subtotal",
        );
  const { baseCurrency, rates } = resolveFxContext(data.companySettings);
  const displayPurchase = resolveUnitPurchasePrice(
    stored.productId,
    data.components,
    data.productComponents ?? [],
    stored,
    data.suppliers,
    baseCurrency,
    rates,
  );
  const money = (v: number) => formatMoney(v, econ.baseCurrency, locale);

  return (
    <main>
      <PageHeader
        title={stored.label}
        description={`${catalogProduct?.name ?? t("components.col.product")} · ${supplier?.name ?? t("batchModal.supplier")} · ${t("batches.qty", { count: stored.quantity.toLocaleString(locale), unit })}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                pipelineStatus === "sold" || pipelineStatus === "arrived"
                  ? "success"
                  : pipelineStatus === "in_transit"
                    ? "accent"
                    : "neutral"
              }
            >
              {t(`batches.pipeline.${pipelineStatus}`)}
            </Badge>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              {t("common.edit")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(t("batches.deleteConfirm"))) {
                  deleteBatch(stored.id);
                  router.push("/batches");
                }
              }}
            >
              {t("common.delete")}
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">
            {t("batchDetail.purchase")}
          </p>
          <p className="mt-1 text-xl tabular-nums">
            {money(econ.purchasePerUnit)}
            <span className="ml-1 text-sm font-normal text-muted">
              / {unit}
            </span>
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-muted">
            {money(econ.purchasePerUnit * stored.quantity)}{" "}
            {t("batchNew.batchTotalShort")}
          </p>
          {econ.skontoPerUnit > 0 ? (
            <p className="text-xs text-muted">
              {t("batchDetail.afterSkonto", {
                list: money(econ.listPurchasePerUnit),
              })}
            </p>
          ) : null}
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">
            {t("batchDetail.landedCost")}
          </p>
          <p className="mt-1 text-xl tabular-nums font-medium text-accent">
            {money(econ.landedCostPerUnit)}
            <span className="ml-1 text-sm font-normal text-muted">
              / {unit}
            </span>
          </p>
          <p className="mt-0.5 text-sm tabular-nums font-medium text-accent">
            {money(econ.landedCostPerUnit * stored.quantity)}{" "}
            <span className="font-normal text-muted">
              {t("batchNew.batchTotalShort")}
            </span>
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-medium">{t("batchDetail.basicData")}</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {stored.poNumber ? (
                <div>
                  <dt className="text-[12px] text-muted">
                    {t("batchDetail.poNumber")}
                  </dt>
                  <dd className="mt-0.5">{stored.poNumber}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[12px] text-muted">
                  {t("batchDetail.orderDate")}
                </dt>
                <dd className="mt-0.5 tabular-nums">
                  {formatDate(stored.orderDate || stored.createdAt, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">
                  {t("batchDetail.expectedArrival")}
                </dt>
                <dd className="mt-0.5 tabular-nums">
                  {stored.expectedArrivalDate
                    ? formatDate(stored.expectedArrivalDate, locale)
                    : t("common.emDash")}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">
                  {t("batchDetail.arrivalDate")}
                </dt>
                <dd className="mt-0.5 tabular-nums">
                  {stored.arrivalDate
                    ? formatDate(stored.arrivalDate, locale)
                    : t("common.emDash")}
                </dd>
              </div>
              {stored.receivedQuantity != null ? (
                <div>
                  <dt className="text-[12px] text-muted">
                    {t("batchDetail.receivedQuantity", { unit })}
                  </dt>
                  <dd className="mt-0.5 tabular-nums">
                    {stored.receivedQuantity.toLocaleString(locale)} /{" "}
                    {stored.quantity.toLocaleString(locale)}
                  </dd>
                </div>
              ) : null}
              {stored.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-[12px] text-muted">
                    {t("batchDetail.notes")}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{stored.notes}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
          <Card>
            <h2 className="mb-3 font-medium">{t("batchDetail.procurement")}</h2>
            <p className="mb-3 text-sm text-muted">
              {econ.commercial.paymentTerms || t("batchDetail.noPaymentTerms")}
              {displayPurchase.source !== "batch" ? (
                <span className="ml-2 text-xs text-muted-soft">
                  (
                  {t("batchDetail.inheritedFrom", {
                    source: displayPurchase.source,
                  })}
                  )
                </span>
              ) : null}
            </p>
            {econ.procurementBreakdown.length === 0 ? (
              <p className="text-sm text-muted">
                {t("batchDetail.noProcurement")}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {econ.procurementBreakdown.map((row) => (
                  <li
                    key={row.item.id}
                    className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0"
                  >
                    <span>
                      {row.item.label}
                      <span className="ml-2 text-xs text-muted">
                        {allocationLabel(row.item.allocation, false, unit)}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {formatEuro(row.perUnit, locale)}
                      <span className="ml-2 text-xs text-muted">
                        ({formatEuro(row.total, locale)} {t("common.total")})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside>
          <Card>
            <h2 className="mb-1 font-medium">{t("batchDetail.landedCost")}</h2>
            <p className="mb-5 text-xs text-muted">
              {t("batchDetail.landedWaterfallHint")}
            </p>
            <WaterfallChart
              steps={landedWaterfall}
              unitLabel={unit}
              quantity={stored.quantity}
            />
          </Card>
        </aside>
      </div>
    </main>
  );
}

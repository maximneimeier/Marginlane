"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import type { Batch, Sale } from "@/lib/types";
import { PROCUREMENT_PHASES, SALES_PHASES } from "@/lib/types";
import { costItemTotal } from "@/lib/calc";
import { createId, formatEuro, formatPercent } from "@/lib/format";
import { emptySale } from "@/lib/migrateAppData";
import { useI18n } from "@/hooks/useI18n";
import { detachDealerFromSale, saleFromDealer } from "@/lib/storage";
import {
  calculateResolvedEconomics,
  resolveCommercial,
  resolveSaleCostItems,
  resolveSalePrice,
  resolveUnitPurchasePrice,
} from "@/lib/resolve";
import { CostItemEditor } from "@/components/CostItemEditor";
import { SalesCostsReadonly } from "@/components/SalesCostsReadonly";
import {
  CommercialOverridesEditor,
  pickCommercialOverrides,
} from "@/components/CommercialOverridesEditor";
import { WaterfallChart } from "@/components/WaterfallChart";
import {
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

function patchSale(batch: Batch, saleId: string, patch: Partial<Sale>): Batch {
  return {
    ...batch,
    sales: batch.sales.map((s) => (s.id === saleId ? { ...s, ...patch } : s)),
  };
}

function addSale(batch: Batch): Batch {
  return {
    ...batch,
    sales: [...batch.sales, emptySale(batch.quantity)],
  };
}

function removeSale(batch: Batch, saleId: string): Batch {
  const next = batch.sales.filter((s) => s.id !== saleId);
  return {
    ...batch,
    sales: next.length > 0 ? next : [emptySale(batch.quantity)],
  };
}

export default function ChargeDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { ready, data, upsertBatch, deleteBatch } = useStore();
  const { t, allocationLabel, locale, pricingUnitLabel } = useI18n();
  const stored = data.batches.find((b) => b.id === id);
  const [draft, setDraft] = useState<Batch | null>(null);
  const [editing, setEditing] = useState(false);

  const batch = editing && draft ? draft : stored;

  if (!ready) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!stored || !batch) {
    return (
      <main>
        <p className="text-sm text-muted">{t("batchDetail.notFound")}</p>
        <Link href="/batches" className="mt-3 inline-block text-sm text-accent">
          {t("common.back")}
        </Link>
      </main>
    );
  }

  const catalogProduct = data.catalogProducts.find(
    (p) => p.id === batch.productId,
  );
  const supplier = data.suppliers.find((s) => s.id === batch.supplierId);
  const unit = catalogProduct
    ? pricingUnitLabel(catalogProduct.pricingUnit)
    : pricingUnitLabel("pcs");
  const econ = calculateResolvedEconomics(data, batch);
  const displayPurchase = resolveUnitPurchasePrice(
    batch.productId,
    data.components,
    data.productComponents ?? [],
    batch,
  );

  function startEdit() {
    setDraft(structuredClone(stored!));
    setEditing(true);
  }

  function save() {
    if (!draft) return;
    upsertBatch(draft);
    setEditing(false);
    setDraft(null);
  }

  function applyDealerToSale(saleId: string, dealerId: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const sale = prev.sales.find((s) => s.id === saleId);
      if (!sale) return prev;

      if (!dealerId) {
        const current = data.dealers.find((d) => d.id === sale.dealerId);
        return patchSale(prev, saleId, detachDealerFromSale(sale, current));
      }

      const next = data.dealers.find((d) => d.id === dealerId);
      if (!next) return prev;
      return patchSale(prev, saleId, {
        ...sale,
        ...saleFromDealer(next, sale.quantity),
      });
    });
  }

  return (
    <main>
      <PageHeader
        title={batch.label}
        description={`${catalogProduct?.name ?? t("components.col.product")} · ${supplier?.name ?? t("batchModal.supplier")} · ${t("batches.qty", { count: batch.quantity.toLocaleString(locale), unit })}`}
        action={
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button onClick={save}>{t("common.save")}</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setDraft(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={startEdit}>
                  {t("common.edit")}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm(t("batches.deleteConfirm"))) {
                      deleteBatch(batch.id);
                      router.push("/batches");
                    }
                  }}
                >
                  {t("common.delete")}
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">
            {t("batchDetail.purchase")}
          </p>
          <p className="mt-1 text-xl tabular-nums">
            {formatEuro(econ.purchasePerUnit)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">
            {t("batchDetail.landedCost")}
          </p>
          <p className="mt-1 text-xl tabular-nums font-medium text-accent">
            {formatEuro(econ.landedCostPerUnit)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">
            {t("batchDetail.sellPriceShort")}
          </p>
          <p className="mt-1 text-xl tabular-nums">
            {formatEuro(econ.sellPrice)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">
            {t("batchDetail.contribution")}
          </p>
          <p
            className={`mt-1 text-xl tabular-nums ${
              econ.contributionPerUnit >= 0 ? "text-accent" : "text-red-700"
            }`}
          >
            {formatEuro(econ.contributionPerUnit)}
          </p>
          <p className="text-xs text-muted">
            {formatPercent(econ.contributionPercent)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          {editing && draft ? (
            <>
              <Card>
                <h2 className="mb-4 font-medium">{t("batchDetail.basicData")}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("batchDetail.label")}>
                    <TextInput
                      value={draft.label}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev ? { ...prev, label: e.target.value } : prev,
                        )
                      }
                    />
                  </Field>
                  <Field label={t("unit.qtyLabel", { unit })}>
                    <TextInput
                      type="number"
                      min="1"
                      value={draft.quantity || ""}
                      onChange={(e) => {
                        const quantity = Number(e.target.value) || 0;
                        setDraft((prev) =>
                          prev ? { ...prev, quantity } : prev,
                        );
                      }}
                    />
                  </Field>
                  <Field
                    label={t("batchDetail.unitPurchase", { unit })}
                    hint={
                      draft.unitPurchasePrice == null
                        ? t("batchDetail.unitPurchaseInherited")
                        : t("batchDetail.unitPurchaseHint")
                    }
                  >
                    <div className="flex h-[34px] items-center rounded-[8px] border border-line bg-surface-faint px-3 text-[13px] tabular-nums text-foreground">
                      {formatEuro(
                        resolveUnitPurchasePrice(
                          draft.productId,
                          data.components,
                          data.productComponents ?? [],
                          draft,
                        ).value,
                      )}
                    </div>
                  </Field>
                </div>
              </Card>
              {supplier ? (
                <CommercialOverridesEditor
                  value={pickCommercialOverrides(draft)}
                  inherited={resolveCommercial(supplier, null, null)}
                  resolved={resolveCommercial(supplier, null, draft)}
                  parentLabel={supplier.name}
                  onChange={(next) =>
                    setDraft((prev) => (prev ? { ...prev, ...next } : prev))
                  }
                />
              ) : null}
              <Card>
                <CostItemEditor
                  title={t("batchDetail.procurement")}
                  items={draft.costItems}
                  onChange={(costItems) => setDraft({ ...draft, costItems })}
                  allowedPhases={PROCUREMENT_PHASES}
                  unitLabel={unit}
                />
              </Card>
              <Card>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="font-medium">{t("batchDetail.salesTitle")}</h2>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setDraft((prev) => (prev ? addSale(prev) : prev))
                    }
                  >
                    {t("batchDetail.addSale")}
                  </Button>
                </div>
                <p className="mb-4 text-[12px] text-muted">
                  {t("batchDetail.salesSpecHint")}
                </p>
                <div className="space-y-6">
                  {draft.sales.map((sale, index) => {
                    const saleDealer = data.dealers.find(
                      (d) => d.id === sale.dealerId,
                    );
                    const resolvedSell = resolveSalePrice(saleDealer, sale);
                    const resolvedCosts = resolveSaleCostItems(saleDealer, sale);
                    const costsInherited =
                      sale.costItems === null && Boolean(sale.dealerId);
                    const sellInherited =
                      sale.salePricePerUnit === null && Boolean(sale.dealerId);

                    return (
                      <div
                        key={sale.id}
                        className="rounded-[10px] border border-line p-4"
                      >
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <h3 className="text-[13px] font-medium">
                            {t("batchDetail.saleN", { n: index + 1 })}
                          </h3>
                          {draft.sales.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-7 px-2 text-[12px]"
                              onClick={() =>
                                setDraft((prev) =>
                                  prev ? removeSale(prev, sale.id) : prev,
                                )
                              }
                            >
                              {t("batchDetail.removeSale")}
                            </Button>
                          ) : null}
                        </div>
                        <div className="mb-5 grid gap-4 sm:grid-cols-2">
                          <Field
                            label={t("batchDetail.dealer")}
                            hint={t("batchDetail.dealerHint")}
                          >
                            <Select
                              value={sale.dealerId || ""}
                              onChange={(e) =>
                                applyDealerToSale(sale.id, e.target.value)
                              }
                            >
                              <option value="">{t("batchDetail.noDealer")}</option>
                              {data.dealers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                  {d.defaultSellPrice > 0
                                    ? ` · VK ${formatEuro(d.defaultSellPrice)}`
                                    : ""}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field label={t("batchDetail.channel")}>
                            <TextInput
                              value={sale.channel}
                              onChange={(e) =>
                                setDraft((prev) =>
                                  prev
                                    ? patchSale(prev, sale.id, {
                                        channel: e.target.value,
                                      })
                                    : prev,
                                )
                              }
                              placeholder={t("batchDetail.channelPlaceholder")}
                            />
                          </Field>
                          <Field label={t("unit.qtyLabel", { unit })}>
                            <TextInput
                              type="number"
                              min="0"
                              value={sale.quantity || ""}
                              onChange={(e) =>
                                setDraft((prev) =>
                                  prev
                                    ? patchSale(prev, sale.id, {
                                        quantity: Number(e.target.value) || 0,
                                      })
                                    : prev,
                                )
                              }
                            />
                          </Field>
                          <Field
                            label={t("batchDetail.sellPrice", { unit })}
                            hint={
                              sellInherited
                                ? t("batchDetail.sellPriceInherited")
                                : t("batchDetail.sellPriceOwn")
                            }
                          >
                            <div className="flex gap-2">
                              <TextInput
                                type="number"
                                step="0.01"
                                min="0"
                                value={resolvedSell.value || ""}
                                onChange={(e) =>
                                  setDraft((prev) =>
                                    prev
                                      ? patchSale(prev, sale.id, {
                                          salePricePerUnit:
                                            Number(e.target.value) || 0,
                                        })
                                      : prev,
                                  )
                                }
                              />
                              {sale.dealerId && sale.salePricePerUnit !== null ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() =>
                                    setDraft((prev) =>
                                      prev
                                        ? patchSale(prev, sale.id, {
                                            salePricePerUnit: null,
                                          })
                                        : prev,
                                    )
                                  }
                                >
                                  {t("batchDetail.inheritAgain")}
                                </Button>
                              ) : null}
                            </div>
                          </Field>
                        </div>
                        {costsInherited ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12px] text-muted">
                                {t("batchDetail.costsInherited")}
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setDraft((prev) => {
                                    if (!prev) return prev;
                                    const items = resolvedCosts.value.map(
                                      (item) => ({
                                        ...item,
                                        id: createId("cost"),
                                      }),
                                    );
                                    return patchSale(prev, sale.id, {
                                      costItems: items,
                                    });
                                  })
                                }
                              >
                                {t("batchDetail.overrideCosts")}
                              </Button>
                            </div>
                            <SalesCostsReadonly
                              items={resolvedCosts.value}
                              emptyHint={t("salesCosts.emptyHint")}
                              unitLabel={unit}
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {sale.dealerId ? (
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() =>
                                    setDraft((prev) =>
                                      prev
                                        ? patchSale(prev, sale.id, {
                                            costItems: null,
                                          })
                                        : prev,
                                    )
                                  }
                                >
                                  {t("batchDetail.inheritAgain")}
                                </Button>
                              </div>
                            ) : null}
                            <CostItemEditor
                              title={t("batchDetail.salesCosts")}
                              items={sale.costItems ?? []}
                              onChange={(costItems) =>
                                setDraft((prev) =>
                                  prev
                                    ? patchSale(prev, sale.id, { costItems })
                                    : prev,
                                )
                              }
                              allowedPhases={SALES_PHASES}
                              percentOfRevenue
                              unitLabel={unit}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <h2 className="mb-3 font-medium">{t("batchDetail.procurement")}</h2>
                <p className="mb-3 text-sm text-muted">
                  {econ.commercial.paymentTerms ||
                    t("batchDetail.noPaymentTerms")}
                  {displayPurchase.source !== "batch" ? (
                    <span className="ml-2 text-xs text-muted-soft">
                      ({t("batchDetail.inheritedFrom", {
                        source: displayPurchase.source,
                      })})
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
                          {formatEuro(row.perUnit)}
                          <span className="ml-2 text-xs text-muted">
                            ({formatEuro(row.total)} {t("common.total")})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              {econ.salesAggregate.rows.length === 0 ? (
                <Card>
                  <h2 className="mb-3 font-medium">{t("batchDetail.sales")}</h2>
                  <p className="text-sm text-muted">
                    {t("batchDetail.noSalesCosts")}
                  </p>
                </Card>
              ) : (
                econ.salesAggregate.rows.map((row, index) => (
                  <Card key={row.sale.id}>
                    <h2 className="mb-3 font-medium">
                      {t("batchDetail.saleN", { n: index + 1 })}
                      {row.sale.channel || row.dealer?.name
                        ? ` — ${row.sale.channel || row.dealer?.name}`
                        : ""}
                    </h2>
                    <p className="mb-3 text-sm text-muted">
                      {t("batchDetail.sellPrice", { unit })}:{" "}
                      {formatEuro(row.sellPrice)}
                      {row.sale.quantity > 0 ? (
                        <span className="ml-2">
                          · {t("unit.qtyLabel", { unit })}:{" "}
                          {row.sale.quantity.toLocaleString(locale)}
                        </span>
                      ) : null}
                    </p>
                    {row.salesItems.length === 0 ? (
                      <p className="text-sm text-muted">
                        {t("batchDetail.noSalesCosts")}
                      </p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {row.salesItems.map((item) => (
                          <li
                            key={item.id}
                            className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0"
                          >
                            <span>{item.label}</span>
                            <span className="tabular-nums">
                              {formatEuro(
                                batch.quantity > 0
                                  ? costItemTotal(
                                      item,
                                      row.sale.quantity,
                                      row.revenue,
                                    ) / batch.quantity
                                  : 0,
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                ))
              )}
            </>
          )}
        </div>

        <aside>
          <Card>
            <h2 className="mb-1 font-medium">{t("batchDetail.unitEconomics")}</h2>
            <p className="mb-5 text-xs text-muted">{t("waterfall.hint")}</p>
            <WaterfallChart steps={econ.waterfall} unitLabel={unit} />
          </Card>
        </aside>
      </div>
    </main>
  );
}

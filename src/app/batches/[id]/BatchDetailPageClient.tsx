"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import type { Batch } from "@/lib/types";
import { PROCUREMENT_PHASES, SALES_PHASES } from "@/lib/types";
import { createId, formatEuro, formatPercent } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { detachDealerFromSales, salesFromDealer } from "@/lib/storage";
import {
  calculateResolvedEconomics,
  resolveCommercial,
  resolveSalesCostItems,
  resolveSellPrice,
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

  const product = data.products.find((p) => p.id === batch.productId);
  const supplier = data.suppliers.find((s) => s.id === batch.supplierId);
  const unit = product
    ? pricingUnitLabel(product.pricingUnit)
    : pricingUnitLabel("pcs");
  const econ = calculateResolvedEconomics(data, batch);
  const displayPurchase = resolveUnitPurchasePrice(
    product,
    batch,
    batch.quantity,
  );
  const displaySell = resolveSellPrice(econ.dealer, batch.sales);
  const displaySalesItems = resolveSalesCostItems(econ.dealer, batch.sales);

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

  return (
    <main>
      <PageHeader
        title={batch.label}
        description={`${product?.name ?? t("products.col.product")} · ${supplier?.name ?? t("batchModal.supplier")} · ${t("batches.qty", { count: batch.quantity.toLocaleString(locale), unit })}`}
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
                  <Field
                    label={t("unit.qtyLabel", { unit })}
                    hint={
                      product?.moq
                        ? t("batchDetail.moqHint", {
                            count: product.moq.toLocaleString(locale),
                            unit,
                          })
                        : undefined
                    }
                  >
                    <TextInput
                      type="number"
                      min="1"
                      value={draft.quantity || ""}
                      onChange={(e) => {
                        const quantity = Number(e.target.value) || 0;
                        setDraft((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            quantity,
                            // EK-Override bleibt; bei Vererbung folgt der Preis der Menge
                            sales: { ...prev.sales, quantity },
                          };
                        });
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
                          data.products.find((p) => p.id === draft.productId),
                          draft,
                          draft.quantity,
                        ).value,
                      )}
                    </div>
                  </Field>
                </div>
              </Card>
              {supplier ? (
                <CommercialOverridesEditor
                  value={pickCommercialOverrides(draft)}
                  inherited={resolveCommercial(supplier, product, null)}
                  resolved={resolveCommercial(supplier, product, draft)}
                  parentLabel={
                    product
                      ? `${supplier.name} / ${product.name}`
                      : supplier.name
                  }
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
                <h2 className="mb-4 font-medium">{t("batchDetail.sales")}</h2>
                <p className="mb-4 text-[12px] text-muted">
                  {t("batchDetail.salesSpecHint")}
                </p>
                <div className="mb-5 grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t("batchDetail.dealer")}
                    hint={t("batchDetail.dealerHint")}
                  >
                    <Select
                      value={draft.sales.dealerId || ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        setDraft((prev) => {
                          if (!prev) return prev;
                          if (!id) {
                            const current = data.dealers.find(
                              (d) => d.id === prev.sales.dealerId,
                            );
                            return {
                              ...prev,
                              sales: detachDealerFromSales(
                                prev.sales,
                                current,
                              ),
                            };
                          }
                          const next = data.dealers.find((d) => d.id === id);
                          if (!next) return prev;
                          return {
                            ...prev,
                            sales: {
                              ...prev.sales,
                              quantity: prev.quantity,
                              ...salesFromDealer(next),
                            },
                          };
                        });
                      }}
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
                      value={draft.sales.channel}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                sales: {
                                  ...prev.sales,
                                  channel: e.target.value,
                                },
                              }
                            : prev,
                        )
                      }
                      placeholder={t("batchDetail.channelPlaceholder")}
                    />
                  </Field>
                  <Field
                    label={t("batchDetail.sellPrice", { unit })}
                    hint={
                      draft.sales.sellPrice === null && draft.sales.dealerId
                        ? t("batchDetail.sellPriceInherited")
                        : t("batchDetail.sellPriceOwn")
                    }
                  >
                    <div className="flex gap-2">
                      <TextInput
                        type="number"
                        step="0.01"
                        min="0"
                        value={
                          resolveSellPrice(
                            data.dealers.find(
                              (d) => d.id === draft.sales.dealerId,
                            ),
                            draft.sales,
                          ).value || ""
                        }
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  sales: {
                                    ...prev.sales,
                                    sellPrice: Number(e.target.value) || 0,
                                  },
                                }
                              : prev,
                          )
                        }
                      />
                      {draft.sales.dealerId &&
                      draft.sales.sellPrice !== null ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    sales: {
                                      ...prev.sales,
                                      sellPrice: null,
                                    },
                                  }
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
                {draft.sales.costItems === null && draft.sales.dealerId ? (
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
                            const items = resolveSalesCostItems(
                              data.dealers.find(
                                (d) => d.id === prev.sales.dealerId,
                              ),
                              prev.sales,
                            ).value;
                            return {
                              ...prev,
                              sales: {
                                ...prev.sales,
                                costItems: items.map((item) => ({
                                  ...item,
                                  id: createId("cost"),
                                })),
                              },
                            };
                          })
                        }
                      >
                        {t("batchDetail.overrideCosts")}
                      </Button>
                    </div>
                    <SalesCostsReadonly
                      items={
                        resolveSalesCostItems(
                          data.dealers.find(
                            (d) => d.id === draft.sales.dealerId,
                          ),
                          draft.sales,
                        ).value
                      }
                      emptyHint={t("salesCosts.emptyHint")}
                      unitLabel={unit}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {draft.sales.dealerId ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    sales: {
                                      ...prev.sales,
                                      costItems: null,
                                    },
                                  }
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
                      items={draft.sales.costItems ?? []}
                      onChange={(costItems) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                sales: { ...prev.sales, costItems },
                              }
                            : prev,
                        )
                      }
                      allowedPhases={SALES_PHASES}
                      percentOfRevenue
                      unitLabel={unit}
                    />
                  </div>
                )}
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
              <Card>
                <h2 className="mb-3 font-medium">
                  {t("batchDetail.sales")}
                  {batch.sales.channel || econ.dealer?.name
                    ? ` — ${batch.sales.channel || econ.dealer?.name}`
                    : ""}
                  {displaySell.source === "dealer" ||
                  displaySalesItems.source === "dealer" ? (
                    <span className="ml-2 text-xs font-normal text-muted-soft">
                      ({t("batchDetail.fromDealer")})
                    </span>
                  ) : null}
                </h2>
                <p className="mb-3 text-sm text-muted">
                  {t("batchDetail.sellPrice", { unit })}:{" "}
                  {formatEuro(econ.sellPrice)}
                </p>
                {econ.salesBreakdown.length === 0 ? (
                  <p className="text-sm text-muted">
                    {t("batchDetail.noSalesCosts")}
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {econ.salesBreakdown.map((row) => (
                      <li
                        key={row.item.id}
                        className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0"
                      >
                        <span>{row.item.label}</span>
                        <span className="tabular-nums">
                          {formatEuro(row.perUnit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
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

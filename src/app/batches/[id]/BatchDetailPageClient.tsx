"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import type { Batch } from "@/lib/types";
import { PROCUREMENT_PHASES, emptyBatchDuty } from "@/lib/types";
import { formatEuro, formatMoney, formatDate } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import {
  calculateResolvedEconomics,
  resolveCommercial,
  resolveUnitPurchasePrice,
} from "@/lib/resolve";
import { resolveFxContext } from "@/lib/fx";
import {
  logisticsTemplateToCostItems,
  rankLogisticsTemplates,
} from "@/lib/logistics";
import { CostItemEditor } from "@/components/CostItemEditor";
import {
  CommercialOverridesEditor,
  pickCommercialOverrides,
} from "@/components/CommercialOverridesEditor";
import { WaterfallChart } from "@/components/WaterfallChart";
import { getBatchPipelineStatusForData } from "@/lib/batchPipeline";
import {
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextInput,
  TextArea,
} from "@/components/ui";

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
  const [draft, setDraft] = useState<Batch | null>(null);
  const [editing, setEditing] = useState(false);
  const [logisticsTemplateId, setLogisticsTemplateId] = useState("");
  const [editBootstrapped, setEditBootstrapped] = useState(false);

  const batch = editing && draft ? draft : stored;

  useEffect(() => {
    if (!ready || !stored || !startEditing || editBootstrapped || editing) {
      return;
    }
    setDraft({
      ...structuredClone(stored),
      duty: stored.duty ?? emptyBatchDuty(),
      quotes: stored.quotes ?? [],
      activeQuoteId: stored.activeQuoteId ?? null,
    });
    setEditing(true);
    setEditBootstrapped(true);
  }, [ready, stored, startEditing, editBootstrapped, editing]);

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
  const pipelineStatus = getBatchPipelineStatusForData(data, batch);
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
    batch.productId,
    data.components,
    data.productComponents ?? [],
    batch,
    data.suppliers,
    baseCurrency,
    rates,
  );
  const money = (v: number) => formatMoney(v, econ.baseCurrency, locale);

  function startEdit() {
    setDraft({
      ...structuredClone(stored!),
      duty: stored!.duty ?? emptyBatchDuty(),
      quotes: stored!.quotes ?? [],
      activeQuoteId: stored!.activeQuoteId ?? null,
    });
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
        description={`${catalogProduct?.name ?? t("components.col.product")} · ${supplier?.name ?? t("batchModal.supplier")} · ${t("batches.qty", { count: batch.quantity.toLocaleString(locale), unit })}`}
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
                    if (window.confirm(t("batches.deleteConfirm"))) {
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
            {money(econ.purchasePerUnit * batch.quantity)}{" "}
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
            {money(econ.landedCostPerUnit * batch.quantity)}{" "}
            <span className="font-normal text-muted">
              {t("batchNew.batchTotalShort")}
            </span>
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
                  <Field label={t("batchDetail.orderDate")}>
                    <TextInput
                      type="date"
                      value={(draft.orderDate || "").slice(0, 10)}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? { ...prev, orderDate: e.target.value || null }
                            : prev,
                        )
                      }
                    />
                  </Field>
                  <Field label={t("batchDetail.expectedArrival")}>
                    <TextInput
                      type="date"
                      value={(draft.expectedArrivalDate || "").slice(0, 10)}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                expectedArrivalDate: e.target.value || null,
                              }
                            : prev,
                        )
                      }
                    />
                  </Field>
                  <Field label={t("batchDetail.arrivalDate")}>
                    <TextInput
                      type="date"
                      value={(draft.arrivalDate || "").slice(0, 10)}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? { ...prev, arrivalDate: e.target.value || null }
                            : prev,
                        )
                      }
                    />
                  </Field>
                  <Field
                    label={t("batchDetail.poNumber")}
                    hint={t("batchNew.poNumberHint")}
                  >
                    <TextInput
                      value={draft.poNumber ?? ""}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? { ...prev, poNumber: e.target.value }
                            : prev,
                        )
                      }
                      placeholder={t("batchNew.poNumberPlaceholder")}
                    />
                  </Field>
                  <Field
                    label={t("batchDetail.receivedQuantity", { unit })}
                    hint={t("batchDetail.receivedQuantityHint")}
                  >
                    <TextInput
                      type="number"
                      min="0"
                      placeholder={String(draft.quantity)}
                      value={draft.receivedQuantity ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                receivedQuantity:
                                  raw === "" ? null : Number(raw) || 0,
                              }
                            : prev,
                        );
                      }}
                    />
                  </Field>
                  <Field
                    label={t("batchDetail.notes")}
                    className="sm:col-span-2"
                  >
                    <TextArea
                      value={draft.notes ?? ""}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev ? { ...prev, notes: e.target.value } : prev,
                        )
                      }
                      rows={3}
                    />
                  </Field>
                  <Field label={t("batchDetail.fxRateOverride")}>
                    <TextInput
                      type="number"
                      min="0"
                      step="0.0001"
                      placeholder={t("batchDetail.fxRateInherited")}
                      value={draft.fxRateOverride ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                fxRateOverride:
                                  raw === "" ? null : Number(raw) || null,
                              }
                            : prev,
                        );
                      }}
                    />
                  </Field>
                  <Field label={t("batchDetail.applySkonto")}>
                    <Select
                      value={
                        draft.applySkonto === null
                          ? "auto"
                          : draft.applySkonto
                            ? "yes"
                            : "no"
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                applySkonto:
                                  v === "auto" ? null : v === "yes",
                              }
                            : prev,
                        );
                      }}
                    >
                      <option value="auto">{t("batchDetail.skontoAuto")}</option>
                      <option value="yes">{t("common.yes")}</option>
                      <option value="no">{t("common.no")}</option>
                    </Select>
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
                      {formatMoney(
                        resolveUnitPurchasePrice(
                          draft.productId,
                          data.components,
                          data.productComponents ?? [],
                          draft,
                          data.suppliers,
                          baseCurrency,
                          rates,
                        ).value,
                        baseCurrency,
                        locale,
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
                <h2 className="mb-4 font-medium">{t("batchDetail.dutyTitle")}</h2>
                <p className="mb-3 text-[12px] text-muted">
                  {t("batchDetail.dutyInheritHint")}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("batchDetail.dutyHs")}>
                    <TextInput
                      value={draft.duty?.hsCode ?? ""}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                duty: {
                                  ...(prev.duty ?? emptyBatchDuty()),
                                  hsCode: e.target.value,
                                },
                              }
                            : prev,
                        )
                      }
                    />
                  </Field>
                  <Field label={t("batchDetail.dutyOrigin")}>
                    <TextInput
                      value={draft.duty?.countryOfOrigin ?? ""}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                duty: {
                                  ...(prev.duty ?? emptyBatchDuty()),
                                  countryOfOrigin: e.target.value,
                                },
                              }
                            : prev,
                        )
                      }
                    />
                  </Field>
                  <Field label={t("batchDetail.dutyRate")}>
                    <TextInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.duty?.ratePercent || ""}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                duty: {
                                  ...(prev.duty ?? emptyBatchDuty()),
                                  ratePercent: Number(e.target.value) || 0,
                                },
                              }
                            : prev,
                        )
                      }
                    />
                  </Field>
                  <Field label={t("batchDetail.dutyFixed")}>
                    <TextInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.duty?.fixedAmount || ""}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                duty: {
                                  ...(prev.duty ?? emptyBatchDuty()),
                                  fixedAmount: Number(e.target.value) || 0,
                                },
                              }
                            : prev,
                        )
                      }
                    />
                  </Field>
                </div>
              </Card>
              <Card>
                <CostItemEditor
                  title={t("batchDetail.procurement")}
                  items={draft.costItems}
                  onChange={(costItems) => setDraft({ ...draft, costItems })}
                  allowedPhases={PROCUREMENT_PHASES}
                  unitLabel={unit}
                />
                {(data.logisticsTemplates ?? []).length > 0 ? (
                  <div className="mt-4 border-t border-line pt-4">
                    <p className="mb-2 text-[13px] font-medium text-foreground">
                      {t("batchDetail.applyLogistics")}
                    </p>
                    <p className="mb-3 text-[12px] text-muted">
                      {t("batchDetail.applyLogisticsHint")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Select
                        className="!w-[260px]"
                        value={logisticsTemplateId}
                        onChange={(e) =>
                          setLogisticsTemplateId(e.target.value)
                        }
                      >
                        <option value="">
                          {t("batchDetail.applyLogisticsChoose")}
                        </option>
                        {rankLogisticsTemplates(
                          data.logisticsTemplates ?? [],
                          {
                            supplierId: draft.supplierId,
                            supplierCountry: supplier?.country,
                            incoterm: resolveCommercial(supplier, null, draft)
                              .incoterm,
                          },
                        ).map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.incoterm
                              ? `${tpl.incoterm} — ${tpl.name}`
                              : tpl.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant="secondary"
                        disabled={!logisticsTemplateId}
                        onClick={() => {
                          const tpl = (data.logisticsTemplates ?? []).find(
                            (x) => x.id === logisticsTemplateId,
                          );
                          if (!tpl) return;
                          const added = logisticsTemplateToCostItems(
                            tpl,
                            data.logisticsBuildingBlocks ?? [],
                          );
                          if (added.length === 0) return;
                          const manual = draft.costItems.filter(
                            (item) =>
                              item.phase !== "transport" &&
                              item.phase !== "lager",
                          );
                          setDraft({
                            ...draft,
                            costItems: [...added, ...manual],
                            ...(tpl.incoterm
                              ? { incoterm: tpl.incoterm }
                              : {}),
                          });
                          setLogisticsTemplateId("");
                        }}
                      >
                        {t("batchDetail.applyLogisticsReplace")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 border-t border-line pt-4 text-[12px] text-muted">
                    {t("batchDetail.applyLogisticsEmpty")}{" "}
                    <Link
                      href="/logistics"
                      className="text-accent hover:underline"
                    >
                      {t("nav.logistics")}
                    </Link>
                  </p>
                )}
              </Card>
              <Card>
                <p className="text-[13px] text-muted">
                  {t("batchDetail.salesMovedHint")}{" "}
                  <Link href="/verkauf" className="text-accent hover:underline">
                    {t("nav.abverkauf")}
                  </Link>
                  .
                </p>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <h2 className="mb-3 font-medium">{t("batchDetail.basicData")}</h2>
                <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                  {batch.poNumber ? (
                    <div>
                      <dt className="text-[12px] text-muted">
                        {t("batchDetail.poNumber")}
                      </dt>
                      <dd className="mt-0.5">{batch.poNumber}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-[12px] text-muted">
                      {t("batchDetail.orderDate")}
                    </dt>
                    <dd className="mt-0.5 tabular-nums">
                      {formatDate(
                        batch.orderDate || batch.createdAt,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-muted">
                      {t("batchDetail.expectedArrival")}
                    </dt>
                    <dd className="mt-0.5 tabular-nums">
                      {batch.expectedArrivalDate
                        ? formatDate(batch.expectedArrivalDate, locale)
                        : t("common.emDash")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-muted">
                      {t("batchDetail.arrivalDate")}
                    </dt>
                    <dd className="mt-0.5 tabular-nums">
                      {batch.arrivalDate
                        ? formatDate(batch.arrivalDate, locale)
                        : t("common.emDash")}
                    </dd>
                  </div>
                  {batch.receivedQuantity != null ? (
                    <div>
                      <dt className="text-[12px] text-muted">
                        {t("batchDetail.receivedQuantity", { unit })}
                      </dt>
                      <dd className="mt-0.5 tabular-nums">
                        {batch.receivedQuantity.toLocaleString(locale)} /{" "}
                        {batch.quantity.toLocaleString(locale)}
                      </dd>
                    </div>
                  ) : null}
                  {batch.notes ? (
                    <div className="sm:col-span-2">
                      <dt className="text-[12px] text-muted">
                        {t("batchDetail.notes")}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap">
                        {batch.notes}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </Card>
              <Card>
              <h2 className="mb-3 font-medium">{t("batchDetail.procurement")}</h2>
              <p className="mb-3 text-sm text-muted">
                {econ.commercial.paymentTerms ||
                  t("batchDetail.noPaymentTerms")}
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
            </>
          )}
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
              quantity={batch.quantity}
            />
          </Card>
        </aside>
      </div>
    </main>
  );
}

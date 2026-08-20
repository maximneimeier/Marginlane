"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import type { Batch, CommercialOverrides, CostItem } from "@/lib/types";
import { emptyBatchDuty, PROCUREMENT_PHASES } from "@/lib/types";
import { createId, formatEuro, formatMoney } from "@/lib/format";
import { emptySale } from "@/lib/migrateAppData";
import { useI18n } from "@/hooks/useI18n";
import {
  calculateResolvedEconomics,
  emptyCommercialOverrides,
  resolveCommercial,
} from "@/lib/resolve";
import {
  logisticsTemplateToCostItems,
  rankLogisticsTemplates,
} from "@/lib/logistics";
import {
  preferredSupplierIdForProduct,
  suppliersForProduct,
  unitPurchaseForProductSupplier,
} from "@/lib/productSuppliers";
import { CostItemEditor } from "@/components/CostItemEditor";
import { CommercialOverridesEditor } from "@/components/CommercialOverridesEditor";
import { WaterfallChart } from "@/components/WaterfallChart";
import {
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextInput,
  TextArea,
} from "@/components/ui";

export default function NewBatchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, data, upsertBatch } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();

  const initialProductId = searchParams.get("product") ?? "";

  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState(500);
  const [unitPrice, setUnitPrice] = useState(0);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [logisticsTemplateId, setLogisticsTemplateId] = useState("");
  const [templateItemIds, setTemplateItemIds] = useState<string[]>([]);
  const [commercialOverrides, setCommercialOverrides] =
    useState<CommercialOverrides>(emptyCommercialOverrides());
  const [priceManual, setPriceManual] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [orderDate, setOrderDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");

  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const product = data.catalogProducts.find((p) => p.id === productId);

  const catalogOptions = useMemo(
    () =>
      [...data.catalogProducts]
        .filter((p) => p.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [data.catalogProducts, locale],
  );

  const productSuppliers = useMemo(
    () => (productId ? suppliersForProduct(data, productId) : []),
    [data, productId],
  );

  const purchaseFromSource = useMemo(
    () =>
      productId && supplierId
        ? unitPurchaseForProductSupplier(data, productId, supplierId, quantity)
        : 0,
    [data, productId, supplierId, quantity],
  );

  const unit = product
    ? pricingUnitLabel(product.pricingUnit)
    : pricingUnitLabel("pcs");

  const commercial = useMemo(
    () => resolveCommercial(supplier, null, commercialOverrides),
    [supplier, commercialOverrides],
  );
  const inheritedCommercial = useMemo(
    () => resolveCommercial(supplier, null, null),
    [supplier],
  );

  const rankedLogistics = useMemo(
    () =>
      rankLogisticsTemplates(data.logisticsTemplates ?? [], {
        supplierId,
        supplierCountry: supplier?.country,
        incoterm: commercial.incoterm,
      }),
    [
      data.logisticsTemplates,
      supplierId,
      supplier?.country,
      commercial.incoterm,
    ],
  );

  useEffect(() => {
    if (!ready || initialized) return;
    const initialProduct = initialProductId
      ? data.catalogProducts.find((p) => p.id === initialProductId)
      : undefined;
    const nextProductId = initialProduct?.id ?? "";
    const nextSupplierId = nextProductId
      ? preferredSupplierIdForProduct(data, nextProductId)
      : "";

    setProductId(nextProductId);
    setSupplierId(nextSupplierId);
    setLabel(
      `PO-${new Date().getFullYear()}-${String(data.batches.length + 1).padStart(3, "0")}`,
    );
    setInitialized(true);
  }, [
    ready,
    initialized,
    initialProductId,
    data,
    data.batches.length,
  ]);

  useEffect(() => {
    if (!initialized || priceManual) return;
    setUnitPrice(purchaseFromSource);
  }, [initialized, purchaseFromSource, priceManual]);

  const draftBatch: Batch = useMemo(() => {
    const sale = emptySale(0);
    const now = new Date().toISOString();
    return {
      id: "draft_new",
      productId: productId || "__none__",
      supplierId: supplierId || "",
      label: label.trim() || "Draft",
      quantity,
      unitPurchasePrice:
        priceManual ? unitPrice : purchaseFromSource > 0 ? purchaseFromSource : null,
      ...commercialOverrides,
      costItems,
      sales: [sale],
      createdAt: now,
      orderDate: orderDate || now.slice(0, 10),
      expectedArrivalDate: expectedArrivalDate || null,
      arrivalDate: arrivalDate || null,
      soldDate: null,
      poNumber: poNumber.trim(),
      notes: notes.trim(),
      receivedQuantity: null,
      applySkonto: null,
      fxRateOverride: null,
      duty: emptyBatchDuty(),
      quotes: [],
      activeQuoteId: null,
    };
  }, [
    productId,
    supplierId,
    label,
    quantity,
    priceManual,
    unitPrice,
    purchaseFromSource,
    commercialOverrides,
    costItems,
    orderDate,
    expectedArrivalDate,
    arrivalDate,
    poNumber,
    notes,
  ]);

  const previewData = useMemo(() => {
    if (!productId) return null;
    try {
      const econ = calculateResolvedEconomics(data, draftBatch);
      const landedIdx = econ.waterfall.findIndex((s) => s.id === "landed");
      const waterfall =
        landedIdx >= 0
          ? econ.waterfall.slice(0, landedIdx + 1)
          : econ.waterfall.filter(
              (s) =>
                s.kind === "base" ||
                s.kind === "cost" ||
                s.kind === "subtotal",
            );
      return { econ, waterfall };
    } catch {
      return null;
    }
  }, [data, draftBatch, productId]);

  function handleProductChange(id: string) {
    setProductId(id);
    setPriceManual(false);
    const nextSupplier = preferredSupplierIdForProduct(data, id);
    setSupplierId(nextSupplier);
  }

  function handleSupplierChange(id: string) {
    setSupplierId(id);
    setPriceManual(false);
  }

  function applyLogisticsTemplate(templateId: string) {
    if (!templateId) {
      setCostItems((prev) =>
        prev.filter((item) => !templateItemIds.includes(item.id)),
      );
      setTemplateItemIds([]);
      setLogisticsTemplateId("");
      return;
    }
    const tpl = (data.logisticsTemplates ?? []).find((x) => x.id === templateId);
    if (!tpl) return;
    const added = logisticsTemplateToCostItems(
      tpl,
      data.logisticsBuildingBlocks ?? [],
    );
    setCostItems((prev) => {
      const manual = prev.filter((item) => !templateItemIds.includes(item.id));
      return [...added, ...manual];
    });
    setTemplateItemIds(added.map((item) => item.id));
    setLogisticsTemplateId(templateId);
    if (tpl.incoterm) {
      setCommercialOverrides((prev) => ({
        ...prev,
        incoterm: tpl.incoterm,
      }));
    }
  }

  function handleSave() {
    if (!product || !label.trim() || quantity <= 0 || !supplierId) return;

    const now = new Date().toISOString();
    const batch: Batch = {
      id: createId("bat"),
      productId: product.id,
      supplierId,
      label: label.trim(),
      quantity,
      unitPurchasePrice:
        priceManual
          ? unitPrice
          : purchaseFromSource > 0
            ? purchaseFromSource
            : null,
      ...commercialOverrides,
      costItems,
      sales: [emptySale(0)],
      createdAt: now,
      orderDate: orderDate || now.slice(0, 10),
      expectedArrivalDate: expectedArrivalDate || null,
      arrivalDate: arrivalDate || null,
      soldDate: null,
      poNumber: poNumber.trim(),
      notes: notes.trim(),
      receivedQuantity: null,
      applySkonto: null,
      fxRateOverride: null,
      duty: emptyBatchDuty(),
      quotes: [],
      activeQuoteId: null,
    };
    upsertBatch(batch);
    router.push(`/batches/${batch.id}`);
  }

  const canSave = Boolean(
    product && label.trim() && quantity > 0 && supplierId,
  );
  const money = (v: number) =>
    formatMoney(v, previewData?.econ.baseCurrency ?? "EUR", locale);

  if (!ready) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }

  return (
    <div>
      <PageHeader
        title={t("batchNew.title")}
        description={t("batchNew.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => router.push("/batches")}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {t("batchNew.save")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-5">
          <Card>
            <h2 className="mb-1 text-[15px] font-semibold">
              {t("batchNew.step.partners")}
            </h2>
            <p className="mb-4 text-[12px] text-muted">
              {t("batchNew.productFirstHint")}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("batchModal.product")} required>
                {catalogOptions.length === 0 ? (
                  <p className="text-[13px] text-muted">
                    {t("batchNew.noProducts")}{" "}
                    <Link
                      href="/products"
                      className="text-accent hover:underline"
                    >
                      {t("nav.products")}
                    </Link>
                  </p>
                ) : (
                  <Select
                    value={productId}
                    onChange={(e) => handleProductChange(e.target.value)}
                  >
                    <option value="">{t("batchNew.chooseProduct")}</option>
                    {catalogOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                label={t("batchModal.supplier")}
                required
                hint={
                  productId && productSuppliers.length === 0
                    ? t("batchNew.noSuppliersForProduct")
                    : undefined
                }
              >
                <Select
                  value={supplierId}
                  disabled={!productId || productSuppliers.length === 0}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                >
                  <option value="">
                    {productId
                      ? t("batchNew.chooseSupplier")
                      : t("batchNew.chooseProductFirst")}
                  </option>
                  {productSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t("batchModal.label")} required>
                <TextInput
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </Field>
              <Field label={t("batchModal.quantity", { unit })} required>
                <TextInput
                  type="number"
                  min="0"
                  value={quantity || ""}
                  onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                />
              </Field>
              <Field
                label={t("batchDetail.poNumber")}
                hint={t("batchNew.poNumberHint")}
              >
                <TextInput
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder={t("batchNew.poNumberPlaceholder")}
                />
              </Field>
              <Field
                label={t("batchDetail.orderDate")}
                hint={t("batchNew.orderDateHint")}
              >
                <TextInput
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </Field>
              <Field
                label={t("batchDetail.expectedArrival")}
                hint={t("batchNew.expectedArrivalHint")}
              >
                <TextInput
                  type="date"
                  value={expectedArrivalDate}
                  onChange={(e) => setExpectedArrivalDate(e.target.value)}
                />
              </Field>
              <Field
                label={t("batchDetail.arrivalDate")}
                hint={t("batchNew.arrivalDateHint")}
              >
                <TextInput
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                />
              </Field>
              <Field
                label={t("batchDetail.notes")}
                hint={t("batchNew.notesHint")}
                className="sm:col-span-2"
              >
                <TextArea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("batchNew.notesPlaceholder")}
                  rows={3}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-[15px] font-semibold">
              {t("batchNew.step.material")}
            </h2>
            <p className="mb-4 text-[12px] text-muted">
              {t("batchModal.bomHint", {
                price: formatEuro(purchaseFromSource, locale),
              })}
            </p>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-medium">
                {t("batchModal.purchasePrice", { unit })}
              </p>
              {!priceManual ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-7 px-2 text-[12px]"
                  onClick={() => setPriceManual(true)}
                >
                  {t("batchModal.overridePrice", { unit })}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 px-2 text-[12px]"
                  onClick={() => {
                    setPriceManual(false);
                    setUnitPrice(purchaseFromSource);
                  }}
                >
                  {t("batchModal.useBomPrice")}
                </Button>
              )}
            </div>
            {!priceManual ? (
              <div className="flex h-[34px] items-center rounded-[8px] border border-line bg-surface-faint px-3 text-[13px] tabular-nums text-foreground">
                {formatEuro(unitPrice || purchaseFromSource, locale)}
                <span className="ml-1.5 text-[12px] text-muted">
                  / {unit}
                </span>
              </div>
            ) : (
              <Field
                label={t("batchModal.unitPurchase", { unit })}
                hint={t("batchModal.overrideHint")}
              >
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice || ""}
                  onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                />
              </Field>
            )}
            {supplier ? (
              <div className="mt-4">
                <CommercialOverridesEditor
                  value={commercialOverrides}
                  inherited={inheritedCommercial}
                  resolved={commercial}
                  parentLabel={supplier.name}
                  onChange={setCommercialOverrides}
                />
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-1 text-[15px] font-semibold">
              {t("batchNew.step.logistics")}
            </h2>
            <p className="mb-3 text-[12px] text-muted">
              {t("batchNew.logisticsReplaceHint")}
            </p>
            {rankedLogistics.length > 0 ? (
              <div className="mb-4">
                <Field label={t("batchNew.logisticsTemplate")}>
                  <Select
                    value={logisticsTemplateId}
                    onChange={(e) => applyLogisticsTemplate(e.target.value)}
                  >
                    <option value="">{t("batchNew.logisticsTemplateNone")}</option>
                    {rankedLogistics.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.incoterm
                          ? `${tpl.incoterm} — ${tpl.name}`
                          : tpl.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : (
              <p className="mb-4 text-[12px] text-muted">
                {t("batchDetail.applyLogisticsEmpty")}{" "}
                <Link href="/logistics" className="text-accent hover:underline">
                  {t("nav.logistics")}
                </Link>
              </p>
            )}
            <CostItemEditor
              items={costItems}
              onChange={setCostItems}
              allowedPhases={PROCUREMENT_PHASES}
              title={t("batchModal.procurementCosts")}
              unitLabel={unit}
            />
          </Card>

          <p className="text-[13px] text-muted">
            {t("batchNew.salesMovedHint")}{" "}
            <Link href="/verkauf" className="text-accent hover:underline">
              {t("nav.abverkauf")}
            </Link>
            .
          </p>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">
            <Card>
              <h2 className="mb-1 text-[14px] font-semibold">
                {t("batchNew.livePurchase")}
              </h2>
              <p className="mb-4 text-[12px] text-muted">
                {t("batchNew.livePurchaseHint")}
              </p>
              {previewData ? (
                <>
                  <div className="mb-4 space-y-3">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 text-[12px]">
                      <span />
                      <span className="text-right text-muted">
                        {t("batchNew.perUnitShort")}
                      </span>
                      <span className="text-right text-muted">
                        {t("batchNew.batchTotalShort")}
                      </span>
                      <span className="text-muted">
                        {t("batchDetail.purchase")}
                      </span>
                      <span className="text-right tabular-nums font-medium">
                        {money(previewData.econ.purchasePerUnit)}
                      </span>
                      <span className="text-right tabular-nums font-medium">
                        {money(
                          previewData.econ.purchasePerUnit * quantity,
                        )}
                      </span>
                      <span className="text-muted">
                        {t("batchDetail.landedCost")}
                      </span>
                      <span className="text-right tabular-nums font-medium text-accent">
                        {money(previewData.econ.landedCostPerUnit)}
                      </span>
                      <span className="text-right tabular-nums font-medium text-accent">
                        {money(
                          previewData.econ.landedCostPerUnit * quantity,
                        )}
                      </span>
                    </div>
                    <p className="border-t border-line pt-2 text-[12px] text-muted">
                      {t("batchNew.saveAsOrdered")}
                    </p>
                  </div>
                  <WaterfallChart
                    steps={previewData.waterfall}
                    unitLabel={unit}
                    quantity={quantity}
                  />
                </>
              ) : (
                <p className="text-[13px] text-muted">
                  {t("batchNew.needProduct")}
                </p>
              )}
            </Card>
            <Button className="w-full" onClick={handleSave} disabled={!canSave}>
              {t("batchNew.save")}
            </Button>
            <Link
              href="/batches"
              className="block text-center text-[13px] text-muted hover:text-foreground"
            >
              {t("common.cancel")}
            </Link>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-line bg-canvas/95 px-1 py-3 backdrop-blur lg:hidden">
        <div className="mb-2 space-y-1 text-[13px]">
          <div className="flex justify-between gap-2">
            <span className="text-muted">
              {t("batchDetail.landedCost")} ({t("batchNew.perUnitShort")})
            </span>
            <span className="tabular-nums font-medium text-accent">
              {previewData ? money(previewData.econ.landedCostPerUnit) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted">
              {t("batchDetail.landedCost")} ({t("batchNew.batchTotalShort")})
            </span>
            <span className="tabular-nums font-medium text-accent">
              {previewData
                ? money(previewData.econ.landedCostPerUnit * quantity)
                : "—"}
            </span>
          </div>
        </div>
        <Button className="w-full" onClick={handleSave} disabled={!canSave}>
          {t("batchNew.save")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppData, Batch, CommercialOverrides, CostItem } from "@/lib/types";
import { PROCUREMENT_PHASES, SALES_PHASES } from "@/lib/types";
import { calculateUnitEconomics } from "@/lib/calc";
import { createId, formatEuro } from "@/lib/format";
import {
  catalogProductUnitPurchaseCost,
  emptySale,
} from "@/lib/migrateAppData";
import { useI18n } from "@/hooks/useI18n";
import {
  detachDealerFromSale,
  saleFromDealer,
} from "@/lib/storage";
import {
  emptyCommercialOverrides,
  resolveCommercial,
  resolveSaleCostItems,
  resolveSalePrice,
} from "@/lib/resolve";
import { CostItemEditor } from "@/components/CostItemEditor";
import { SalesCostsReadonly } from "@/components/SalesCostsReadonly";
import { CommercialOverridesEditor } from "@/components/CommercialOverridesEditor";
import {
  Button,
  Field,
  Modal,
  Select,
  TextInput,
} from "@/components/ui";

type Props = {
  open: boolean;
  data: AppData;
  initialProductId?: string;
  onClose: () => void;
  onSave: (batch: Batch) => void;
};

export function BatchFormModal({
  open,
  data,
  initialProductId = "",
  onClose,
  onSave,
}: Props) {
  const { t, locale, pricingUnitLabel } = useI18n();
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState(500);
  const [unitPrice, setUnitPrice] = useState(0);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [dealerId, setDealerId] = useState("");
  const [channel, setChannel] = useState("");
  const [sellPrice, setSellPrice] = useState<number | null>(0);
  const [salesItems, setSalesItems] = useState<CostItem[] | null>([]);
  const [commercialOverrides, setCommercialOverrides] =
    useState<CommercialOverrides>(emptyCommercialOverrides());
  const [priceManual, setPriceManual] = useState(false);

  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const product = data.catalogProducts.find((p) => p.id === productId);
  const dealer = data.dealers.find((d) => d.id === dealerId);

  const bomPurchase = useMemo(
    () =>
      productId
        ? catalogProductUnitPurchaseCost(
            productId,
            data.components,
            data.productComponents ?? [],
          )
        : 0,
    [productId, data.components, data.productComponents],
  );

  const unit = product
    ? pricingUnitLabel(product.pricingUnit)
    : pricingUnitLabel("pcs");

  const saleDraft = useMemo(
    () => ({
      id: "draft",
      salePricePerUnit: sellPrice,
      quantity,
      channel,
      dealerId: dealerId || null,
      costItems: salesItems,
    }),
    [sellPrice, quantity, channel, dealerId, salesItems],
  );

  const resolvedSell = resolveSalePrice(dealer, saleDraft).value;
  const resolvedSalesItems = resolveSaleCostItems(dealer, saleDraft).value;
  const sellInherited = Boolean(dealer && sellPrice === null);
  const costsInherited = Boolean(dealer && salesItems === null);

  const commercial = useMemo(
    () => resolveCommercial(supplier, null, commercialOverrides),
    [supplier, commercialOverrides],
  );
  const inheritedCommercial = useMemo(
    () => resolveCommercial(supplier, null, null),
    [supplier],
  );

  const catalogOptions = useMemo(
    () =>
      [...data.catalogProducts]
        .filter((p) => p.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [data.catalogProducts, locale],
  );

  useEffect(() => {
    if (!open) return;
    const initialProduct = initialProductId
      ? data.catalogProducts.find((p) => p.id === initialProductId)
      : undefined;
    const comps = initialProduct
      ? (() => {
          const ids = new Set(
            (data.productComponents ?? [])
              .filter((pc) => pc.productId === initialProduct.id)
              .map((pc) => pc.componentId),
          );
          return data.components.filter((c) => ids.has(c.id));
        })()
      : [];
    const nextSupplierId =
      comps.find((c) => c.supplierId)?.supplierId ??
      data.suppliers[0]?.id ??
      "";

    setSupplierId(nextSupplierId);
    setProductId(initialProduct?.id ?? "");
    setLabel(
      `PO-${new Date().getFullYear()}-${String(data.batches.length + 1).padStart(3, "0")}`,
    );
    setQuantity(500);
    setUnitPrice(0);
    setCostItems([]);
    setDealerId("");
    setChannel("");
    setSellPrice(0);
    setSalesItems([]);
    setCommercialOverrides(emptyCommercialOverrides());
    setPriceManual(false);
  }, [
    open,
    initialProductId,
    data.catalogProducts,
    data.productComponents,
    data.suppliers,
    data.batches.length,
  ]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || priceManual) return;
    setUnitPrice(bomPurchase);
  }, [open, bomPurchase, priceManual]);

  const preview = calculateUnitEconomics({
    quantity,
    unitPurchasePrice: unitPrice,
    procurementItems: costItems,
    sellPrice: resolvedSell,
    salesItems: resolvedSalesItems,
  });

  function applyDealer(id: string) {
    if (!id) {
      const detached = detachDealerFromSale(saleDraft, dealer);
      setDealerId("");
      setChannel(detached.channel);
      setSellPrice(detached.salePricePerUnit);
      setSalesItems(detached.costItems);
      return;
    }
    const next = data.dealers.find((d) => d.id === id);
    if (!next) return;
    const linked = saleFromDealer(next, quantity);
    setDealerId(next.id);
    setChannel(linked.channel);
    setSellPrice(linked.salePricePerUnit);
    setSalesItems(linked.costItems);
  }

  function handleProductChange(id: string) {
    setProductId(id);
    setPriceManual(false);
    const ids = new Set(
      (data.productComponents ?? [])
        .filter((pc) => pc.productId === id)
        .map((pc) => pc.componentId),
    );
    const comps = data.components.filter((c) => ids.has(c.id));
    const fromBom = comps.find((c) => c.supplierId)?.supplierId;
    if (fromBom) setSupplierId(fromBom);
  }

  function handleSave() {
    if (!product || !label.trim() || quantity <= 0) return;

    const sale = emptySale(quantity);
    if (dealerId) {
      sale.dealerId = dealerId;
      sale.channel = channel.trim() || dealer?.name || "";
      sale.salePricePerUnit = sellPrice;
      sale.costItems = salesItems;
    } else {
      sale.channel = channel.trim();
      sale.salePricePerUnit = sellPrice ?? 0;
      sale.costItems = salesItems ?? [];
    }

    const batch: Batch = {
      id: createId("bat"),
      productId: product.id,
      supplierId: supplierId || "",
      label: label.trim(),
      quantity,
      unitPurchasePrice: priceManual ? unitPrice : null,
      ...commercialOverrides,
      costItems,
      sales: [sale],
      createdAt: new Date().toISOString(),
    };
    onSave(batch);
    onClose();
  }

  const canSave = Boolean(product && label.trim() && quantity > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("batchModal.createTitle")}
      description={t("batchModal.description")}
      wide
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("batchModal.product")} required>
            <Select
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
            >
              <option value="">{t("batchModal.selectProduct")}</option>
              {catalogOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("batchModal.supplier")}>
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">{t("batchModal.noSupplier")}</option>
              {[...data.suppliers]
                .sort((a, b) => a.name.localeCompare(b.name, locale))
                .map((s) => (
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
        </div>

        <div className="rounded-[10px] border border-line bg-surface-faint p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-medium">
              {t("batchModal.purchasePrice", { unit })}
            </p>
            {!priceManual ? (
              <Button
                type="button"
                variant="ghost"
                className="h-7 px-2 text-[12px]"
                onClick={() => setPriceManual(true)}
              >
                {t("batchModal.overridePrice")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="h-7 px-2 text-[12px]"
                onClick={() => {
                  setPriceManual(false);
                  setUnitPrice(bomPurchase);
                }}
              >
                {t("batchModal.useBomPrice")}
              </Button>
            )}
          </div>
          <p className="mb-2 text-[12px] text-muted">
            {t("batchModal.bomHint", { price: formatEuro(bomPurchase, locale) })}
          </p>
          <TextInput
            type="number"
            step="0.01"
            min="0"
            disabled={!priceManual}
            value={unitPrice || ""}
            onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
          />
        </div>

        <CommercialOverridesEditor
          value={commercialOverrides}
          inherited={inheritedCommercial}
          resolved={commercial}
          parentLabel={supplier?.name ?? t("batchModal.supplier")}
          onChange={setCommercialOverrides}
        />

        <CostItemEditor
          items={costItems}
          onChange={setCostItems}
          allowedPhases={PROCUREMENT_PHASES}
          title={t("batchModal.procurementCosts")}
        />

        <div className="rounded-[10px] border border-line p-3">
          <p className="mb-3 text-[13px] font-medium">
            {t("batchModal.salesSection")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("batchModal.dealer")}>
              <Select
                value={dealerId}
                onChange={(e) => applyDealer(e.target.value)}
              >
                <option value="">{t("batchModal.noDealer")}</option>
                {[...data.dealers]
                  .filter((d) => d.status === "active")
                  .sort((a, b) => a.name.localeCompare(b.name, locale))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t("batchModal.channel")}>
              <TextInput
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder={t("batchModal.channelPlaceholder")}
              />
            </Field>
            <Field
              label={t("batchModal.sellPrice", { unit })}
              hint={
                sellInherited
                  ? t("batchModal.sellPriceInherited", {
                      name: dealer?.name ?? "",
                    })
                  : t("batchModal.sellPriceOwn")
              }
            >
              <div className="flex gap-2">
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellPrice ?? ""}
                  onChange={(e) =>
                    setSellPrice(
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  placeholder={
                    sellInherited
                      ? String(dealer?.defaultSellPrice ?? "")
                      : undefined
                  }
                />
                {dealerId && sellPrice !== null ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => setSellPrice(null)}
                  >
                    {t("batchModal.inherit")}
                  </Button>
                ) : null}
              </div>
            </Field>
          </div>

          {costsInherited && dealer ? (
            <div className="mt-3">
              <SalesCostsReadonly items={resolvedSalesItems} />
              <Button
                type="button"
                variant="ghost"
                className="mt-2 h-7 px-2 text-[12px]"
                onClick={() => setSalesItems(resolvedSalesItems)}
              >
                {t("batchModal.overrideCosts")}
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <CostItemEditor
                items={salesItems ?? []}
                onChange={(items) => setSalesItems(items)}
                allowedPhases={SALES_PHASES}
                title={t("batchModal.salesCosts")}
              />
              {dealerId ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 h-7 px-2 text-[12px]"
                  onClick={() => setSalesItems(null)}
                >
                  {t("batchModal.inheritCosts")}
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-[10px] border border-line bg-surface-faint p-3 text-[13px]">
          <p className="font-medium">{t("batchModal.preview")}</p>
          <p className="mt-1 text-muted">
            {t("batchModal.previewLanded")}:{" "}
            {formatEuro(preview.landedCostPerUnit, locale)} ·{" "}
            {t("batchModal.previewMargin")}:{" "}
            {formatEuro(preview.contributionPerUnit, locale)}
          </p>
          <p className="text-[12px] text-muted-soft">
            {commercial.currency} · {commercial.paymentTerms} ·{" "}
            {commercial.incoterm}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

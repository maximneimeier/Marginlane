"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppData, Batch, CommercialOverrides, CostItem } from "@/lib/types";
import { PROCUREMENT_PHASES, SALES_PHASES } from "@/lib/types";
import {
  calculateUnitEconomics,
  resolvePurchasePrice,
} from "@/lib/calc";
import { createId, formatEuro, formatPercent } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import {
  detachDealerFromSales,
  emptySalesData,
  salesFromDealer,
} from "@/lib/storage";
import {
  emptyCommercialOverrides,
  resolveCommercial,
  resolveSalesCostItems,
  resolveSellPrice,
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
  /** Optional vorausgewähltes Produkt */
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
  /** null = vom Händler erben (nur mit dealerId) */
  const [sellPrice, setSellPrice] = useState<number | null>(0);
  const [salesItems, setSalesItems] = useState<CostItem[] | null>([]);
  const [commercialOverrides, setCommercialOverrides] =
    useState<CommercialOverrides>(emptyCommercialOverrides());
  const [priceManual, setPriceManual] = useState(false);

  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const product = data.products.find((p) => p.id === productId);
  const dealer = data.dealers.find((d) => d.id === dealerId);

  const unit = product
    ? pricingUnitLabel(product.pricingUnit)
    : pricingUnitLabel("pcs");

  const salesDraft = useMemo(
    () => ({
      sellPrice,
      quantity,
      channel,
      dealerId: dealerId || null,
      costItems: salesItems,
    }),
    [sellPrice, quantity, channel, dealerId, salesItems],
  );

  const resolvedSell = resolveSellPrice(dealer, salesDraft).value;
  const resolvedSalesItems = resolveSalesCostItems(dealer, salesDraft).value;
  const sellInherited = Boolean(dealer && sellPrice === null);
  const costsInherited = Boolean(dealer && salesItems === null);

  const commercial = useMemo(
    () => resolveCommercial(supplier, product, commercialOverrides),
    [supplier, product, commercialOverrides],
  );
  const inheritedCommercial = useMemo(
    () => resolveCommercial(supplier, product, null),
    [supplier, product],
  );

  const supplierProducts = useMemo(
    () =>
      data.products
        .filter((p) => p.supplierId === supplierId)
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [data.products, supplierId, locale],
  );

  const pricing = useMemo(() => {
    if (!product) return null;
    return resolvePurchasePrice(
      product.unitPrice,
      quantity,
      product.discountTiers,
    );
  }, [product, quantity]);

  useEffect(() => {
    if (!open) return;
    const initialProduct = initialProductId
      ? data.products.find((p) => p.id === initialProductId)
      : undefined;
    const nextSupplierId = initialProduct?.supplierId ?? "";
    const nextProductId = initialProduct?.id ?? "";

    setSupplierId(nextSupplierId);
    setProductId(nextProductId);
    setLabel(
      `PO-${new Date().getFullYear()}-${String(data.batches.length + 1).padStart(3, "0")}`,
    );
    setQuantity(
      initialProduct && initialProduct.moq > 0 ? initialProduct.moq : 500,
    );
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
    data.products,
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
    if (!open || !pricing || priceManual) return;
    setUnitPrice(pricing.unitPrice);
  }, [open, pricing, priceManual]);

  const preview = calculateUnitEconomics({
    quantity,
    unitPurchasePrice: unitPrice,
    procurementItems: costItems,
    sellPrice: resolvedSell,
    salesItems: resolvedSalesItems,
  });

  function applyDealer(id: string) {
    if (!id) {
      const detached = detachDealerFromSales(salesDraft, dealer);
      setDealerId("");
      setChannel(detached.channel);
      setSellPrice(detached.sellPrice);
      setSalesItems(detached.costItems);
      return;
    }
    const next = data.dealers.find((d) => d.id === id);
    if (!next) return;
    const linked = salesFromDealer(next);
    setDealerId(next.id);
    setChannel(linked.channel);
    setSellPrice(linked.sellPrice);
    setSalesItems(linked.costItems);
  }

  function handleSupplierChange(id: string) {
    setSupplierId(id);
    setProductId("");
    setPriceManual(false);
    setUnitPrice(0);
  }

  function handleProductChange(id: string) {
    setProductId(id);
    setPriceManual(false);
    const p = data.products.find((x) => x.id === id);
    if (p && p.moq > 0) setQuantity(p.moq);
  }

  function handleSave() {
    if (!product || !supplier || !label.trim() || quantity <= 0) return;

    const sales = dealerId
      ? {
          quantity,
          channel: channel.trim() || dealer?.name || "",
          dealerId: dealerId as string,
          sellPrice,
          costItems: salesItems,
        }
      : {
          ...emptySalesData(quantity),
          channel: channel.trim(),
          sellPrice: sellPrice ?? 0,
          costItems: salesItems ?? [],
        };

    const batch: Batch = {
      id: createId("bat"),
      productId: product.id,
      supplierId: supplier.id,
      label: label.trim(),
      quantity,
      unitPurchasePrice: priceManual ? unitPrice : null,
      ...commercialOverrides,
      costItems,
      sales,
      createdAt: new Date().toISOString(),
    };
    onSave(batch);
    onClose();
  }

  const canSave = Boolean(
    supplier && product && label.trim() && quantity > 0,
  );

  const nextTier = product
    ? [...product.discountTiers]
        .filter((tier) => quantity < tier.minQty)
        .sort((a, b) => a.minQty - b.minQty)[0]
    : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("batchModal.createTitle")}
      description={t("batchModal.description")}
      wide
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="grid gap-3 rounded-[10px] border border-line bg-surface-faint px-3.5 py-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
              {t("batchModal.landedCostPerUnit", { unit })}
            </p>
            <p className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight">
              {formatEuro(preview.landedCostPerUnit)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
              {t("batchModal.marginPerUnit", { unit })}
            </p>
            <p
              className={`mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight ${
                preview.contributionPerUnit >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatEuro(preview.contributionPerUnit)}
            </p>
          </div>
        </div>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
            {t("batchModal.section.order")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("batchModal.supplier")} required>
              <Select
                value={supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                autoFocus={!initialProductId}
              >
                <option value="">{t("batchModal.selectSupplier")}</option>
                {[...data.suppliers]
                  .sort((a, b) => a.name.localeCompare(b.name, locale))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.incoterm ? ` · ${s.incoterm}` : ""}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t("batchModal.product")} required>
              <Select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                disabled={!supplierId}
              >
                <option value="">
                  {supplierId
                    ? t("batchModal.selectProduct")
                    : t("batchModal.selectSupplierFirst")}
                </option>
                {supplierProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.sku ? ` (${p.sku})` : ""}
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
            <Field
              label={t("unit.qtyLabel", { unit })}
              required
              hint={
                product?.moq
                  ? t("batchModal.moqHint", {
                      count: product.moq.toLocaleString(locale),
                      unit,
                    })
                  : undefined
              }
            >
              <TextInput
                type="number"
                min="1"
                value={quantity || ""}
                onChange={(e) => {
                  setQuantity(Number(e.target.value) || 0);
                  setPriceManual(false);
                }}
              />
            </Field>
          </div>
        </section>

        {supplier ? (
          <CommercialOverridesEditor
            value={commercialOverrides}
            inherited={inheritedCommercial}
            resolved={commercial}
            parentLabel={
              product
                ? `${supplier.name} / ${product.name}`
                : supplier.name
            }
            onChange={setCommercialOverrides}
          />
        ) : null}

        <section className="rounded-[12px] border border-line bg-white p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">
                {t("batchModal.purchasePrice")}
              </h3>
              <p className="mt-0.5 text-[12px] text-muted">
                {t("batchModal.purchaseHint")}
              </p>
            </div>
            {priceManual ? (
              <button
                type="button"
                className="text-[12px] font-medium text-accent hover:underline"
                onClick={() => setPriceManual(false)}
              >
                {t("batchModal.restoreAuto")}
              </button>
            ) : (
              <span className="rounded-[6px] bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                {t("batchModal.automatic")}
              </span>
            )}
          </div>

          {!product ? (
            <p className="text-[13px] text-muted">
              {t("batchModal.selectProductForPrice")}
            </p>
          ) : (
            <>
              <dl className="mb-4 grid gap-2 text-[13px] sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">{t("batchModal.listPrice")}</dt>
                  <dd className="font-medium tabular-nums sm:mt-0.5">
                    {formatEuro(pricing?.listPrice ?? product.unitPrice)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">{t("batchModal.discount")}</dt>
                  <dd className="font-medium tabular-nums sm:mt-0.5">
                    {pricing && pricing.discountPercent > 0 ? (
                      <>
                        −{formatPercent(pricing.discountPercent)}
                        {pricing.tierMinQty != null ? (
                          <span className="ml-1 text-[12px] font-normal text-muted-soft">
                            (
                            {t("batchModal.fromQty", {
                              count: pricing.tierMinQty.toLocaleString(locale),
                              unit,
                            })}
                            )
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-soft">
                        {t("batchModal.noTierDiscount")}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">{t("batchModal.unitPurchase", { unit })}</dt>
                  <dd className="text-[15px] font-semibold tabular-nums text-foreground sm:mt-0.5">
                    {formatEuro(unitPrice)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">{t("batchModal.goodsValue")}</dt>
                  <dd className="font-medium tabular-nums sm:mt-0.5">
                    {formatEuro(unitPrice * Math.max(quantity, 0))}
                    {pricing && pricing.savingsPerUnit > 0 ? (
                      <span className="ml-1 text-[12px] font-normal text-success">
                        (−
                        {formatEuro(
                          pricing.savingsPerUnit * Math.max(quantity, 0),
                        )}{" "}
                        {t("batchModal.vsList")})
                      </span>
                    ) : null}
                  </dd>
                </div>
              </dl>

              {product.discountTiers.length > 0 ? (
                <div className="mb-4 rounded-[8px] border border-line bg-surface-faint px-3 py-2.5">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    {t("batchModal.discountTiers")}
                  </p>
                  <ul className="space-y-1">
                    {[...product.discountTiers]
                      .sort((a, b) => a.minQty - b.minQty)
                      .map((tier) => {
                        const active =
                          pricing?.tierMinQty === tier.minQty &&
                          pricing.discountPercent === tier.discountPercent;
                        return (
                          <li
                            key={`${tier.minQty}-${tier.discountPercent}`}
                            className={`flex justify-between gap-3 text-[12px] ${
                              active
                                ? "font-medium text-foreground"
                                : "text-muted"
                            }`}
                          >
                            <span>
                              {t("batchModal.fromQty", {
                                count: tier.minQty.toLocaleString(locale),
                                unit,
                              })}
                              {active ? ` · ${t("batchModal.tierActive")}` : ""}
                            </span>
                            <span className="tabular-nums">
                              −{formatPercent(tier.discountPercent)} →{" "}
                              {formatEuro(
                                product.unitPrice *
                                  (1 - tier.discountPercent / 100),
                              )}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                  {nextTier ? (
                    <p className="mt-2 text-[12px] text-muted">
                      {t("batchModal.nextTier", {
                        minQty: nextTier.minQty.toLocaleString(locale),
                        percent: formatPercent(nextTier.discountPercent),
                        remaining: (
                          nextTier.minQty - quantity
                        ).toLocaleString(locale),
                        unit,
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <Field
                label={t("batchModal.overridePrice", { unit })}
                hint={t("batchModal.overrideHint")}
              >
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice || ""}
                  onChange={(e) => {
                    setPriceManual(true);
                    setUnitPrice(Number(e.target.value) || 0);
                  }}
                />
              </Field>
            </>
          )}
        </section>

        <section>
          <CostItemEditor
            title={t("batchModal.procurementCosts")}
            items={costItems}
            onChange={setCostItems}
            allowedPhases={PROCUREMENT_PHASES}
            unitLabel={unit}
          />
        </section>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
            {t("batchModal.section.sales")}
          </h3>
          <p className="mb-3 text-[12px] text-muted">
            {t("batchModal.salesSpecHint")}
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field
              label={t("batchModal.dealer")}
              hint={t("batchModal.dealerHint")}
            >
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
                      {d.defaultSellPrice > 0
                        ? ` · VK ${formatEuro(d.defaultSellPrice)}`
                        : ""}
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
                  value={resolvedSell || ""}
                  onChange={(e) =>
                    setSellPrice(Number(e.target.value) || 0)
                  }
                />
                {dealer && !sellInherited ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSellPrice(null)}
                  >
                    {t("batchModal.inheritAgain")}
                  </Button>
                ) : null}
              </div>
            </Field>
          </div>

          {costsInherited ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-muted">
                  {t("batchModal.costsInherited", {
                    name: dealer?.name ?? "",
                  })}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setSalesItems(
                      resolvedSalesItems.map((item) => ({
                        ...item,
                        id: createId("cost"),
                      })),
                    )
                  }
                >
                  {t("batchModal.overrideCosts")}
                </Button>
              </div>
              <SalesCostsReadonly
                items={resolvedSalesItems}
                emptyHint={t("salesCosts.emptyHint")}
                unitLabel={unit}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {dealer ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSalesItems(null)}
                  >
                    {t("batchModal.inheritAgain")}
                  </Button>
                </div>
              ) : null}
              <CostItemEditor
                title={t("batchModal.salesCosts")}
                items={salesItems ?? []}
                onChange={(items) => setSalesItems(items)}
                allowedPhases={SALES_PHASES}
                percentOfRevenue
                unitLabel={unit}
              />
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!canSave}>
            {t("batchModal.saveBatch")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

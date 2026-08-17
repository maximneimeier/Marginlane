"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import type { Batch, CommercialOverrides, CostItem } from "@/lib/types";
import { emptyBatchDuty, PROCUREMENT_PHASES, SALES_PHASES } from "@/lib/types";
import { createId, formatEuro, formatMoney, formatPercent } from "@/lib/format";
import {
  catalogProductUnitPurchaseCost,
  emptySale,
} from "@/lib/migrateAppData";
import { useI18n } from "@/hooks/useI18n";
import { detachDealerFromSale, saleFromDealer } from "@/lib/storage";
import {
  calculateResolvedEconomics,
  emptyCommercialOverrides,
  resolveCommercial,
  resolveSaleCostItems,
  resolveSalePrice,
} from "@/lib/resolve";
import {
  buildBatchContributionWaterfall,
  getBatchContribution,
} from "@/lib/batchContribution";
import {
  logisticsTemplateToCostItems,
  rankLogisticsTemplates,
} from "@/lib/logistics";
import { CostItemEditor } from "@/components/CostItemEditor";
import { SalesCostsReadonly } from "@/components/SalesCostsReadonly";
import { CommercialOverridesEditor } from "@/components/CommercialOverridesEditor";
import { WaterfallChart } from "@/components/WaterfallChart";
import {
  Button,
  Card,
  Field,
  PageHeader,
  TextInput,
} from "@/components/ui";

type StepId = "partners" | "material" | "logistics" | "sales" | "result";

const STEPS: StepId[] = [
  "partners",
  "material",
  "logistics",
  "sales",
  "result",
];

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
  const [dealerId, setDealerId] = useState("");
  const [channel, setChannel] = useState("");
  const [sellPrice, setSellPrice] = useState<number | null>(0);
  const [salesItems, setSalesItems] = useState<CostItem[] | null>([]);
  const [commercialOverrides, setCommercialOverrides] =
    useState<CommercialOverrides>(emptyCommercialOverrides());
  const [priceManual, setPriceManual] = useState(false);
  const [activeStep, setActiveStep] = useState<StepId>("partners");
  const [initialized, setInitialized] = useState(false);

  const sectionRefs = useRef<Partial<Record<StepId, HTMLElement | null>>>({});

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

  const activeSuppliers = useMemo(
    () =>
      [...data.suppliers].sort((a, b) => a.name.localeCompare(b.name, locale)),
    [data.suppliers, locale],
  );

  const activeDealers = useMemo(
    () =>
      [...data.dealers]
        .filter((d) => d.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [data.dealers, locale],
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
    setInitialized(true);
  }, [
    ready,
    initialized,
    initialProductId,
    data.catalogProducts,
    data.productComponents,
    data.components,
    data.suppliers,
    data.batches.length,
  ]);

  useEffect(() => {
    if (!initialized || priceManual) return;
    setUnitPrice(bomPurchase);
  }, [initialized, bomPurchase, priceManual]);

  const draftBatch: Batch = useMemo(() => {
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
    const now = new Date().toISOString();
    return {
      id: "draft_new",
      productId: productId || "__none__",
      supplierId: supplierId || "",
      label: label.trim() || "Draft",
      quantity,
      unitPurchasePrice: priceManual ? unitPrice : null,
      ...commercialOverrides,
      costItems,
      sales: [sale],
      createdAt: now,
      orderDate: now.slice(0, 10),
      arrivalDate: null,
      soldDate: now.slice(0, 10),
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
    commercialOverrides,
    costItems,
    dealerId,
    channel,
    dealer?.name,
    sellPrice,
    salesItems,
  ]);

  const previewData = useMemo(() => {
    if (!productId) return null;
    const withProduct = {
      ...data,
      // ensure draft product resolves if somehow missing
      catalogProducts: data.catalogProducts,
    };
    try {
      const econ = calculateResolvedEconomics(withProduct, draftBatch);
      const contrib = getBatchContribution(withProduct, draftBatch);
      const waterfall = buildBatchContributionWaterfall(
        contrib,
        draftBatch.quantity,
        0,
      );
      return { econ, contrib, waterfall };
    } catch {
      return null;
    }
  }, [data, draftBatch, productId]);

  function scrollToStep(step: StepId) {
    setActiveStep(step);
    sectionRefs.current[step]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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

  function applyLogisticsTemplate(templateId: string) {
    const tpl = (data.logisticsTemplates ?? []).find((x) => x.id === templateId);
    if (!tpl) return;
    const added = logisticsTemplateToCostItems(
      tpl,
      data.logisticsBuildingBlocks ?? [],
    );
    if (added.length === 0) return;
    setCostItems((prev) => [...prev, ...added]);
    scrollToStep("logistics");
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

    const now = new Date().toISOString();
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
      createdAt: now,
      orderDate: now.slice(0, 10),
      arrivalDate: null,
      soldDate: now.slice(0, 10),
      applySkonto: null,
      fxRateOverride: null,
      duty: emptyBatchDuty(),
      quotes: [],
      activeQuoteId: null,
    };
    upsertBatch(batch);
    router.push(`/batches/${batch.id}`);
  }

  const canSave = Boolean(product && label.trim() && quantity > 0);
  const money = (v: number) =>
    formatMoney(v, previewData?.econ.baseCurrency ?? "EUR", locale);
  const qty = Math.max(quantity, 0);
  const perUnit = (n: number) => (qty > 0 ? n / qty : 0);

  const stepDone: Record<StepId, boolean> = {
    partners: Boolean(productId && supplierId),
    material: Boolean(productId && (unitPrice > 0 || bomPurchase > 0)),
    logistics: costItems.some(
      (i) => i.phase === "transport" || i.phase === "lager",
    ),
    sales: Boolean(dealerId || resolvedSell > 0),
    result: Boolean(previewData && previewData.contrib.revenue > 0),
  };

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

      <div className="mb-5 flex flex-wrap gap-1.5">
        {STEPS.map((step, index) => {
          const active = activeStep === step;
          const done = stepDone[step];
          return (
            <button
              key={step}
              type="button"
              onClick={() => scrollToStep(step)}
              className={`inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                active
                  ? "border-accent/40 bg-accent-soft/50 text-foreground"
                  : done
                    ? "border-line bg-white text-foreground"
                    : "border-line bg-surface-faint text-muted"
              }`}
            >
              <span className="tabular-nums text-muted-soft">{index + 1}</span>
              {t(`batchNew.step.${step}`)}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-5">
          <section
            ref={(el) => {
              sectionRefs.current.partners = el;
            }}
            className="scroll-mt-24"
          >
            <Card>
              <h2 className="mb-1 text-[15px] font-semibold">
                {t("batchNew.step.partners")}
              </h2>
              <p className="mb-4 text-[12px] text-muted">
                {t("batchNew.partnersHint")}
              </p>

              <p className="mb-2 text-[12px] font-medium text-muted">
                {t("batchModal.product")}
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {catalogOptions.length === 0 ? (
                  <p className="text-[13px] text-muted">
                    {t("batchNew.noProducts")}{" "}
                    <Link href="/products" className="text-accent hover:underline">
                      {t("nav.products")}
                    </Link>
                  </p>
                ) : (
                  catalogOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProductChange(p.id)}
                      className={`rounded-[8px] border px-2.5 py-1.5 text-[13px] transition-colors ${
                        productId === p.id
                          ? "border-accent bg-accent-soft/40 font-medium text-foreground"
                          : "border-line bg-white text-muted hover:bg-surface-faint hover:text-foreground"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))
                )}
              </div>

              <p className="mb-2 text-[12px] font-medium text-muted">
                {t("batchModal.supplier")}
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {activeSuppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSupplierId(s.id)}
                    className={`rounded-[8px] border px-2.5 py-1.5 text-[13px] transition-colors ${
                      supplierId === s.id
                        ? "border-accent bg-accent-soft/40 font-medium text-foreground"
                        : "border-line bg-white text-muted hover:bg-surface-faint hover:text-foreground"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
            </Card>
          </section>

          <section
            ref={(el) => {
              sectionRefs.current.material = el;
            }}
            className="scroll-mt-24"
          >
            <Card>
              <h2 className="mb-1 text-[15px] font-semibold">
                {t("batchNew.step.material")}
              </h2>
              <p className="mb-4 text-[12px] text-muted">
                {t("batchModal.bomHint", {
                  price: formatEuro(bomPurchase, locale),
                })}
              </p>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
              <TextInput
                type="number"
                step="0.01"
                min="0"
                disabled={!priceManual}
                value={unitPrice || ""}
                onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
              />
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
          </section>

          <section
            ref={(el) => {
              sectionRefs.current.logistics = el;
            }}
            className="scroll-mt-24"
          >
            <Card>
              <h2 className="mb-1 text-[15px] font-semibold">
                {t("batchNew.step.logistics")}
              </h2>
              <p className="mb-3 text-[12px] text-muted">
                {t("batchNew.logisticsHint")}
              </p>
              {rankedLogistics.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {rankedLogistics.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyLogisticsTemplate(tpl.id)}
                      className="rounded-[8px] border border-line bg-white px-2.5 py-1.5 text-[13px] text-muted hover:bg-surface-faint hover:text-foreground"
                    >
                      + {tpl.name}
                    </button>
                  ))}
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
          </section>

          <section
            ref={(el) => {
              sectionRefs.current.sales = el;
            }}
            className="scroll-mt-24"
          >
            <Card>
              <h2 className="mb-1 text-[15px] font-semibold">
                {t("batchNew.step.sales")}
              </h2>
              <p className="mb-3 text-[12px] text-muted">
                {t("batchNew.salesHint")}
              </p>

              <p className="mb-2 text-[12px] font-medium text-muted">
                {t("batchModal.dealer")}
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyDealer("")}
                  className={`rounded-[8px] border px-2.5 py-1.5 text-[13px] ${
                    !dealerId
                      ? "border-accent bg-accent-soft/40 font-medium"
                      : "border-line bg-white text-muted"
                  }`}
                >
                  {t("batchModal.noDealer")}
                </button>
                {activeDealers.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => applyDealer(d.id)}
                    className={`rounded-[8px] border px-2.5 py-1.5 text-[13px] transition-colors ${
                      dealerId === d.id
                        ? "border-accent bg-accent-soft/40 font-medium text-foreground"
                        : "border-line bg-white text-muted hover:bg-surface-faint hover:text-foreground"
                    }`}
                  >
                    {d.name}
                    {d.defaultSellPrice > 0
                      ? ` · ${formatEuro(d.defaultSellPrice, locale)}`
                      : ""}
                  </button>
                ))}
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2">
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
                        setSellPrice(
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                        )
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
                <div>
                  <SalesCostsReadonly
                    items={resolvedSalesItems}
                    unitLabel={unit}
                  />
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
                <div>
                  <CostItemEditor
                    items={salesItems ?? []}
                    onChange={(items) => setSalesItems(items)}
                    allowedPhases={SALES_PHASES}
                    title={t("batchModal.salesCosts")}
                    percentOfRevenue
                    unitLabel={unit}
                    salesMode
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
            </Card>
          </section>

          <section
            ref={(el) => {
              sectionRefs.current.result = el;
            }}
            className="scroll-mt-24 lg:hidden"
          >
            <Card>
              <h2 className="mb-3 text-[15px] font-semibold">
                {t("batchNew.step.result")}
              </h2>
              {previewData ? (
                <WaterfallChart
                  steps={previewData.waterfall}
                  unitLabel={unit}
                />
              ) : (
                <p className="text-[13px] text-muted">{t("batchNew.needProduct")}</p>
              )}
              <Button
                className="mt-4 w-full"
                onClick={handleSave}
                disabled={!canSave}
              >
                {t("batchNew.save")}
              </Button>
            </Card>
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">
            <Card>
              <h2 className="mb-1 text-[14px] font-semibold">
                {t("batchNew.liveMargins")}
              </h2>
              <p className="mb-4 text-[12px] text-muted">
                {t("batchNew.liveMarginsHint")}
              </p>
              {previewData ? (
                <>
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted">
                        DB1
                      </p>
                      <p className="text-[15px] tabular-nums font-medium">
                        {money(perUnit(previewData.contrib.db1))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted">
                        DB2
                      </p>
                      <p className="text-[15px] tabular-nums font-medium">
                        {money(perUnit(previewData.contrib.db2))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted">
                        DB3
                      </p>
                      <p className="text-[15px] tabular-nums font-medium text-accent">
                        {money(perUnit(previewData.contrib.db3))}
                      </p>
                      <p className="text-[11px] text-muted">
                        {formatPercent(
                          previewData.contrib.revenue > 0
                            ? (previewData.contrib.db3 /
                                previewData.contrib.revenue) *
                                100
                            : 0,
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mb-3 space-y-1 text-[12px] text-muted">
                    <p>
                      {t("batchDetail.landedCost")}:{" "}
                      <span className="tabular-nums text-foreground">
                        {money(previewData.econ.landedCostPerUnit)}
                      </span>
                    </p>
                    <p>
                      {t("batchDetail.kpi.marketing")}:{" "}
                      <span className="tabular-nums text-foreground">
                        {money(perUnit(previewData.contrib.marketing))}
                      </span>
                      {" · "}
                      {t("batchDetail.kpi.salesCosts")}:{" "}
                      <span className="tabular-nums text-foreground">
                        {money(perUnit(previewData.contrib.sales))}
                      </span>
                    </p>
                  </div>
                  <WaterfallChart
                    steps={previewData.waterfall}
                    unitLabel={unit}
                  />
                </>
              ) : (
                <p className="text-[13px] text-muted">
                  {t("batchNew.needProduct")}
                </p>
              )}
            </Card>
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={!canSave}
            >
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
    </div>
  );
}

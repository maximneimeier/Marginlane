"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import type {
  CatalogProduct,
  CatalogProductStatus,
  Component,
  PricingUnit,
  ProductComponent,
  ProductDocument,
} from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
import { CURRENCIES, MAX_PRODUCT_DOCUMENTS } from "@/lib/types";
import { formatEuro, formatPercent } from "@/lib/format";
import {
  catalogProductUnitPurchaseCost,
  effectiveComponentUnitPrice,
  emptyComponent,
  emptyProductComponent,
  emptyProductDocument,
} from "@/lib/migrateAppData";
import { resolveComponentCurrency } from "@/lib/resolve";
import { useI18n } from "@/hooks/useI18n";
import { CountryFlag } from "@/components/CountryFlag";
import {
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";

type EditSection = "master" | "documents" | "bom" | null;

type BomLine = {
  component: Component;
  link: ProductComponent;
};

type BomSortKey =
  | "name"
  | "sku"
  | "supplier"
  | "qty"
  | "unitPrice"
  | "lineTotal"
  | "share";

export default function ProductDetailPageClient({ id }: { id: string }) {
  const {
    ready,
    data,
    upsertCatalogProduct,
    upsertComponent,
    upsertProductComponent,
    deleteProductComponent,
  } = useStore();
  const { t, locale, lang, pricingUnitLabel, pricingUnits } = useI18n();
  const [editing, setEditing] = useState<EditSection>(null);
  const [masterDraft, setMasterDraft] = useState<CatalogProduct | null>(null);
  const [docsDraft, setDocsDraft] = useState<ProductDocument[]>([]);
  const [bomDraft, setBomDraft] = useState<BomLine[]>([]);
  const [bomSort, setBomSort] = useState<{
    key: BomSortKey;
    dir: "asc" | "desc";
  }>({ key: "lineTotal", dir: "desc" });

  const product = data.catalogProducts.find((p) => p.id === id);

  const bomRows = useMemo(() => {
    if (!product) return [];
    const links = (data.productComponents ?? []).filter(
      (pc) => pc.productId === product.id,
    );
    return links
      .map((link) => {
        const component = data.components.find((c) => c.id === link.componentId);
        if (!component) return null;
        const unitPrice = effectiveComponentUnitPrice(component, link);
        const lineTotal = unitPrice * Math.max(link.quantityPerProductUnit, 0);
        const supplier = data.suppliers.find(
          (s) => s.id === component.supplierId,
        );
        const currency = resolveComponentCurrency(component, supplier);
        return { link, component, supplier, unitPrice, lineTotal, currency };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }, [product, data.productComponents, data.components, data.suppliers]);

  const sortedBomRows = useMemo(() => {
    const rows = [...bomRows];
    const dir = bomSort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (bomSort.key) {
        case "name":
          return a.component.name.localeCompare(b.component.name, lang) * dir;
        case "sku":
          return (
            (a.component.sku || "").localeCompare(b.component.sku || "", lang) *
            dir
          );
        case "supplier":
          return (
            (a.supplier?.name || "").localeCompare(
              b.supplier?.name || "",
              lang,
            ) * dir
          );
        case "qty":
          return (
            (a.link.quantityPerProductUnit - b.link.quantityPerProductUnit) *
            dir
          );
        case "unitPrice":
          return (a.unitPrice - b.unitPrice) * dir;
        case "share":
        case "lineTotal":
          return (a.lineTotal - b.lineTotal) * dir;
        default:
          return 0;
      }
    });
    return rows;
  }, [bomRows, bomSort, lang]);

  const purchaseTotal = product
    ? catalogProductUnitPurchaseCost(
        product.id,
        data.components,
        data.productComponents ?? [],
      )
    : 0;

  const bomDraftPurchase = useMemo(() => {
    if (!product) return 0;
    return catalogProductUnitPurchaseCost(
      product.id,
      bomDraft.map((l) => l.component),
      bomDraft.map((l) => ({ ...l.link, productId: product.id })),
    );
  }, [product, bomDraft]);

  function toggleBomSort(key: BomSortKey) {
    setBomSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : {
            key,
            dir:
              key === "name" || key === "sku" || key === "supplier"
                ? "asc"
                : "desc",
          },
    );
  }

  function cancelEdit() {
    setEditing(null);
    setMasterDraft(null);
    setDocsDraft([]);
    setBomDraft([]);
  }

  function startMasterEdit() {
    if (!product) return;
    cancelEdit();
    setMasterDraft(
      structuredClone({
        ...product,
        documents: product.documents ?? [],
      }),
    );
    setEditing("master");
  }

  function startDocsEdit() {
    if (!product) return;
    cancelEdit();
    setDocsDraft(structuredClone(product.documents ?? []));
    setEditing("documents");
  }

  function startBomEdit() {
    if (!product) return;
    cancelEdit();
    const links = (data.productComponents ?? []).filter(
      (pc) => pc.productId === product.id,
    );
    setBomDraft(
      links.map((link) => {
        const component =
          data.components.find((c) => c.id === link.componentId) ??
          emptyComponent();
        return {
          link: structuredClone(link),
          component: structuredClone(
            component.id === link.componentId
              ? component
              : { ...emptyComponent(), id: link.componentId },
          ),
        };
      }),
    );
    setEditing("bom");
  }

  function saveMaster() {
    if (!masterDraft || !masterDraft.name.trim() || !masterDraft.sku.trim()) {
      return;
    }
    upsertCatalogProduct({
      ...masterDraft,
      name: masterDraft.name.trim(),
      sku: masterDraft.sku.trim(),
      category: masterDraft.category.trim(),
      notes: masterDraft.notes.trim(),
      documents: product?.documents ?? [],
    });
    cancelEdit();
  }

  function saveDocuments() {
    if (!product) return;
    const documents = docsDraft
      .filter((d) => d.title.trim() || d.url.trim() || d.notes.trim())
      .slice(0, MAX_PRODUCT_DOCUMENTS)
      .map((d) => ({
        ...d,
        title: d.title.trim(),
        url: d.url.trim(),
        notes: d.notes.trim(),
      }));
    upsertCatalogProduct({ ...product, documents });
    cancelEdit();
  }

  function saveBom() {
    if (!product) return;
    const kept = bomDraft.filter(
      (l) => l.component.name.trim() || l.component.purchasePricePerUnit > 0,
    );
    const components = kept.map((l) => ({
      ...l.component,
      name: l.component.name.trim() || t("productModal.componentDefaultName"),
    }));
    const links = kept.map((l) => ({
      ...l.link,
      productId: product.id,
      componentId: l.component.id,
      quantityPerProductUnit: Math.max(l.link.quantityPerProductUnit, 0),
    }));

    for (const c of components) {
      upsertComponent(c);
    }
    const existingLinks = (data.productComponents ?? []).filter(
      (pc) => pc.productId === product.id,
    );
    const nextIds = new Set(links.map((l) => l.id));
    for (const link of existingLinks) {
      if (!nextIds.has(link.id)) deleteProductComponent(link.id);
    }
    for (const link of links) {
      upsertProductComponent(link);
    }
    cancelEdit();
  }

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  if (!product) {
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-muted">{t("productDetail.notFound")}</p>
        <Link href="/products" className="text-[13px] text-accent hover:underline">
          {t("productDetail.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={
          product.sku
            ? `${t("products.col.sku")}: ${product.sku}`
            : t("productDetail.subtitle")
        }
        action={
          <Link href="/products">
            <Button variant="secondary">{t("productDetail.back")}</Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <SectionHeader
            title={t("productDetail.masterTitle")}
            hint={t("productDetail.masterHint")}
            editing={editing === "master"}
            onEdit={startMasterEdit}
            onCancel={cancelEdit}
            onSave={saveMaster}
            saveDisabled={
              !masterDraft?.name.trim() || !masterDraft?.sku.trim()
            }
            trailing={
              editing === "master" ? null : (
                <Badge
                  tone={product.status === "active" ? "success" : "neutral"}
                >
                  {t(`products.status.${product.status}` as MessageKey)}
                </Badge>
              )
            }
          />

          {editing === "master" && masterDraft ? (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("productModal.name")} required>
                  <TextInput
                    value={masterDraft.name}
                    onChange={(e) =>
                      setMasterDraft({ ...masterDraft, name: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("productModal.sku")} required>
                  <TextInput
                    value={masterDraft.sku}
                    onChange={(e) =>
                      setMasterDraft({ ...masterDraft, sku: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("productModal.category")}>
                  <TextInput
                    value={masterDraft.category}
                    onChange={(e) =>
                      setMasterDraft({
                        ...masterDraft,
                        category: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label={t("productModal.pricingUnit")}>
                  <Select
                    value={masterDraft.pricingUnit}
                    onChange={(e) =>
                      setMasterDraft({
                        ...masterDraft,
                        pricingUnit: e.target.value as PricingUnit,
                      })
                    }
                  >
                    {pricingUnits.map((u) => (
                      <option key={u} value={u}>
                        {pricingUnitLabel(u)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={t("productModal.listPrice", {
                    unit: pricingUnitLabel(masterDraft.pricingUnit),
                  })}
                >
                  <TextInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={masterDraft.listPrice ?? ""}
                    onChange={(e) =>
                      setMasterDraft({
                        ...masterDraft,
                        listPrice:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value) || 0,
                      })
                    }
                  />
                </Field>
                <Field label={t("productModal.currency")}>
                  <Select
                    value={masterDraft.currency}
                    onChange={(e) =>
                      setMasterDraft({
                        ...masterDraft,
                        currency: e.target.value,
                      })
                    }
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("products.col.targetMargin")}>
                  <TextInput
                    type="number"
                    step="0.1"
                    min="0"
                    value={masterDraft.targetMarginPercent ?? ""}
                    onChange={(e) =>
                      setMasterDraft({
                        ...masterDraft,
                        targetMarginPercent:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value) || 0,
                      })
                    }
                  />
                </Field>
                <Field label={t("products.col.hsCode")}>
                  <TextInput
                    value={masterDraft.hsCode ?? ""}
                    onChange={(e) =>
                      setMasterDraft({
                        ...masterDraft,
                        hsCode: e.target.value,
                      })
                    }
                    placeholder="9401.61"
                  />
                </Field>
                <Field label={t("products.col.countryOfOrigin")}>
                  <TextInput
                    value={masterDraft.countryOfOrigin ?? ""}
                    onChange={(e) =>
                      setMasterDraft({
                        ...masterDraft,
                        countryOfOrigin: e.target.value,
                      })
                    }
                    placeholder="CN"
                  />
                </Field>
                <Field label={t("products.col.dutyRate")}>
                  <TextInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={masterDraft.dutyRatePercent || ""}
                    onChange={(e) =>
                      setMasterDraft({
                        ...masterDraft,
                        dutyRatePercent: Number(e.target.value) || 0,
                      })
                    }
                  />
                </Field>
                <Field label={t("productModal.status")}>
                  <Select
                    value={masterDraft.status}
                    onChange={(e) =>
                      setMasterDraft({
                        ...masterDraft,
                        status: e.target.value as CatalogProductStatus,
                      })
                    }
                  >
                    <option value="active">{t("products.status.active")}</option>
                    <option value="inactive">
                      {t("products.status.inactive")}
                    </option>
                  </Select>
                </Field>
              </div>
              <Field label={t("productDetail.notes")}>
                <TextArea
                  rows={3}
                  value={masterDraft.notes}
                  onChange={(e) =>
                    setMasterDraft({ ...masterDraft, notes: e.target.value })
                  }
                />
              </Field>
              <p className="text-[12px] text-muted">
                {t("products.col.purchase")}:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatEuro(purchaseTotal, locale)}
                </span>
                <span className="text-muted-soft">
                  {" "}
                  ({t("productDetail.purchaseReadonly")})
                </span>
              </p>
            </div>
          ) : (
            <>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailField
                  label={t("products.col.sku")}
                  value={product.sku || t("common.emDash")}
                />
                <DetailField
                  label={t("products.col.category")}
                  value={product.category || t("common.emDash")}
                />
                <DetailField
                  label={t("products.col.unit")}
                  value={pricingUnitLabel(product.pricingUnit)}
                />
                <DetailField
                  label={t("products.col.listPrice")}
                  value={
                    product.listPrice != null
                      ? `${formatEuro(product.listPrice, locale)} ${product.currency}`
                      : t("common.emDash")
                  }
                />
                <DetailField
                  label={t("products.col.targetMargin")}
                  value={
                    product.targetMarginPercent != null
                      ? formatPercent(product.targetMarginPercent, locale)
                      : t("common.emDash")
                  }
                />
                <DetailField
                  label={t("products.col.hsCode")}
                  value={product.hsCode || t("common.emDash")}
                />
                <DetailField
                  label={t("products.col.dutyRate")}
                  value={
                    product.dutyRatePercent > 0
                      ? formatPercent(product.dutyRatePercent, locale)
                      : t("common.emDash")
                  }
                />
                <DetailField
                  label={t("products.col.purchase")}
                  value={formatEuro(purchaseTotal, locale)}
                  emphasize
                />
              </dl>
              {product.notes ? (
                <div className="mt-4 rounded-[10px] border border-line bg-surface-faint px-3.5 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    {t("productDetail.notes")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">
                    {product.notes}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </Card>

        <Card>
          <SectionHeader
            title={t("productDetail.documentsTitle")}
            hint={t("productDetail.documentsHint", {
              count: String(
                editing === "documents"
                  ? docsDraft.length
                  : (product.documents ?? []).length,
              ),
              max: String(MAX_PRODUCT_DOCUMENTS),
            })}
            editing={editing === "documents"}
            onEdit={startDocsEdit}
            onCancel={cancelEdit}
            onSave={saveDocuments}
          />

          {editing === "documents" ? (
            <div className="mt-4 space-y-2">
              {docsDraft.length === 0 ? (
                <p className="py-3 text-center text-[12px] text-muted">
                  {t("productModal.documentsEmpty")}
                </p>
              ) : (
                docsDraft.map((doc) => (
                  <div
                    key={doc.id}
                    className="grid gap-2 rounded-[8px] border border-line bg-surface-faint p-2 sm:grid-cols-[1fr_1.2fr_auto]"
                  >
                    <TextInput
                      value={doc.title}
                      onChange={(e) =>
                        setDocsDraft((prev) =>
                          prev.map((d) =>
                            d.id === doc.id
                              ? { ...d, title: e.target.value }
                              : d,
                          ),
                        )
                      }
                      placeholder={t("productModal.documentTitle")}
                    />
                    <TextInput
                      value={doc.url}
                      onChange={(e) =>
                        setDocsDraft((prev) =>
                          prev.map((d) =>
                            d.id === doc.id ? { ...d, url: e.target.value } : d,
                          ),
                        )
                      }
                      placeholder={t("productModal.documentUrl")}
                    />
                    <Button
                      variant="danger"
                      className="h-9 px-2"
                      onClick={() =>
                        setDocsDraft((prev) =>
                          prev.filter((d) => d.id !== doc.id),
                        )
                      }
                    >
                      ×
                    </Button>
                    <TextInput
                      className="sm:col-span-3"
                      value={doc.notes}
                      onChange={(e) =>
                        setDocsDraft((prev) =>
                          prev.map((d) =>
                            d.id === doc.id
                              ? { ...d, notes: e.target.value }
                              : d,
                          ),
                        )
                      }
                      placeholder={t("productModal.documentNotes")}
                    />
                  </div>
                ))
              )}
              <Button
                variant="secondary"
                disabled={docsDraft.length >= MAX_PRODUCT_DOCUMENTS}
                onClick={() =>
                  setDocsDraft((prev) =>
                    prev.length >= MAX_PRODUCT_DOCUMENTS
                      ? prev
                      : [...prev, emptyProductDocument()],
                  )
                }
              >
                {t("productModal.addDocument")}
              </Button>
            </div>
          ) : (product.documents ?? []).length === 0 ? (
            <div className="mt-4 rounded-[10px] border border-dashed border-line px-4 py-8 text-center">
              <p className="text-[13px] font-medium text-foreground">
                {t("productDetail.documentsEmptyTitle")}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[12px] text-muted">
                {t("productDetail.documentsEmptyBody")}
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {(product.documents ?? []).map((doc, index) => (
                <li
                  key={doc.id}
                  className="flex items-start gap-3 rounded-[10px] border border-line bg-surface-faint px-3.5 py-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-white text-[12px] font-semibold text-accent shadow-[var(--shadow-sm)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {doc.url.trim() ? (
                      <a
                        href={doc.url.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:text-accent"
                      >
                        {doc.title || t("productDetail.documentUntitled")}
                      </a>
                    ) : (
                      <p className="font-medium text-foreground">
                        {doc.title || t("productDetail.documentUntitled")}
                      </p>
                    )}
                    {doc.notes ? (
                      <p className="mt-0.5 text-[12px] text-muted">{doc.notes}</p>
                    ) : null}
                    {doc.url.trim() ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-soft">
                        {doc.url.trim()}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="border-b border-line px-4 py-3">
          <SectionHeader
            title={t("productDetail.bomTitle")}
            hint={
              (editing === "bom" ? bomDraft.length : bomRows.length) === 0
                ? t("productDetail.bomEmptyHint")
                : t("productDetail.bomHint", {
                    count: String(
                      editing === "bom" ? bomDraft.length : bomRows.length,
                    ),
                  })
            }
            editing={editing === "bom"}
            onEdit={startBomEdit}
            onCancel={cancelEdit}
            onSave={saveBom}
          />
        </div>

        {editing === "bom" ? (
          <div className="space-y-3 p-4">
            {bomDraft.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-muted">
                {t("productModal.componentsEmpty")}
              </p>
            ) : (
              <div className="space-y-2">
                {bomDraft.map((row) => (
                  <div
                    key={row.link.id}
                    className="grid gap-2 rounded-[8px] border border-line bg-surface-faint p-2 sm:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_auto]"
                  >
                    <TextInput
                      value={row.component.name}
                      onChange={(e) =>
                        setBomDraft((prev) =>
                          prev.map((r) =>
                            r.link.id === row.link.id
                              ? {
                                  ...r,
                                  component: {
                                    ...r.component,
                                    name: e.target.value,
                                  },
                                }
                              : r,
                          ),
                        )
                      }
                      placeholder={t("productModal.componentName")}
                    />
                    <Select
                      value={row.component.supplierId}
                      onChange={(e) => {
                        const supplierId = e.target.value;
                        setBomDraft((prev) =>
                          prev.map((r) =>
                            r.link.id === row.link.id
                              ? {
                                  ...r,
                                  component: {
                                    ...r.component,
                                    supplierId,
                                    currency: supplierId
                                      ? null
                                      : (r.component.currency ?? "EUR"),
                                  },
                                }
                              : r,
                          ),
                        );
                      }}
                    >
                      <option value="">
                        {t("productModal.componentSupplier")}
                      </option>
                      {[...data.suppliers]
                        .sort((a, b) => a.name.localeCompare(b.name, lang))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </Select>
                    <TextInput
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.component.purchasePricePerUnit || ""}
                      onChange={(e) =>
                        setBomDraft((prev) =>
                          prev.map((r) =>
                            r.link.id === row.link.id
                              ? {
                                  ...r,
                                  component: {
                                    ...r.component,
                                    purchasePricePerUnit:
                                      Number(e.target.value) || 0,
                                  },
                                }
                              : r,
                          ),
                        )
                      }
                      placeholder={t("productModal.componentPrice")}
                    />
                    <TextInput
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.link.quantityPerProductUnit || ""}
                      onChange={(e) =>
                        setBomDraft((prev) =>
                          prev.map((r) =>
                            r.link.id === row.link.id
                              ? {
                                  ...r,
                                  link: {
                                    ...r.link,
                                    quantityPerProductUnit:
                                      Number(e.target.value) || 0,
                                  },
                                }
                              : r,
                          ),
                        )
                      }
                      placeholder={t("productModal.componentQty")}
                    />
                    <Button
                      variant="danger"
                      className="h-9 px-2"
                      onClick={() =>
                        setBomDraft((prev) =>
                          prev.filter((r) => r.link.id !== row.link.id),
                        )
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const component = emptyComponent();
                  setBomDraft((prev) => [
                    ...prev,
                    {
                      component,
                      link: emptyProductComponent(product.id, component.id),
                    },
                  ]);
                }}
              >
                {t("productModal.addComponent")}
              </Button>
              <p className="text-[13px] font-medium tabular-nums text-foreground">
                {t("productModal.computedPurchase")}:{" "}
                {formatEuro(bomDraftPurchase, locale)}
              </p>
            </div>
          </div>
        ) : bomRows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft text-muted">
              <BomEmptyIcon />
            </div>
            <p className="text-[13px] font-medium text-foreground">
              {t("productDetail.bomEmptyTitle")}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12px] text-muted">
              {t("productDetail.bomEmptyBody")}
            </p>
            <Button className="mt-4" onClick={startBomEdit}>
              {t("productDetail.bomEmptyCta")}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  <BomSortTh
                    label={t("productModal.componentName")}
                    active={bomSort.key === "name"}
                    dir={bomSort.dir}
                    onClick={() => toggleBomSort("name")}
                  />
                  <BomSortTh
                    label={t("products.col.sku")}
                    active={bomSort.key === "sku"}
                    dir={bomSort.dir}
                    onClick={() => toggleBomSort("sku")}
                  />
                  <BomSortTh
                    label={t("productModal.componentSupplier")}
                    active={bomSort.key === "supplier"}
                    dir={bomSort.dir}
                    onClick={() => toggleBomSort("supplier")}
                  />
                  <BomSortTh
                    label={t("productModal.componentQty")}
                    active={bomSort.key === "qty"}
                    dir={bomSort.dir}
                    align="right"
                    onClick={() => toggleBomSort("qty")}
                  />
                  <BomSortTh
                    label={t("productModal.componentPrice")}
                    active={bomSort.key === "unitPrice"}
                    dir={bomSort.dir}
                    align="right"
                    onClick={() => toggleBomSort("unitPrice")}
                  />
                  <BomSortTh
                    label={t("productDetail.bomCol.lineTotal")}
                    active={bomSort.key === "lineTotal"}
                    dir={bomSort.dir}
                    align="right"
                    onClick={() => toggleBomSort("lineTotal")}
                  />
                  <BomSortTh
                    label={t("productDetail.bomCol.share")}
                    active={bomSort.key === "share"}
                    dir={bomSort.dir}
                    align="right"
                    onClick={() => toggleBomSort("share")}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedBomRows.map((row) => (
                  <tr
                    key={row.link.id}
                    className="border-b border-line last:border-0 hover:bg-surface-faint"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.component.name}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">
                      {row.component.sku || t("common.emDash")}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {row.supplier ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CountryFlag code={row.supplier.country} />
                          {row.supplier.name}
                        </span>
                      ) : (
                        t("productDetail.noSupplier")
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.link.quantityPerProductUnit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {formatEuro(row.unitPrice, locale)}
                      <span className="ml-1 text-[11px] text-muted-soft">
                        {row.currency.value}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                      {formatEuro(row.lineTotal, locale)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {purchaseTotal > 0
                        ? formatPercent(
                            (row.lineTotal / purchaseTotal) * 100,
                            locale,
                          )
                        : t("common.emDash")}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-faint">
                  <td
                    colSpan={5}
                    className="px-4 py-3 text-[13px] font-medium text-foreground"
                  >
                    {t("productDetail.bomTotal")}
                  </td>
                  <td className="px-4 py-3 text-right text-[15px] font-semibold tabular-nums tracking-tight text-foreground">
                    {formatEuro(purchaseTotal, locale)}
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] text-muted-soft">
                    / {pricingUnitLabel(product.pricingUnit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[14px] font-medium text-foreground">
              {t("productDetail.batchesTitle")}
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              {t("productDetail.batchesHint")}
            </p>
          </div>
          <Link href={`/batches?new=1&product=${product.id}`}>
            <Button variant="secondary">{t("products.action.batch")}</Button>
          </Link>
        </div>
        <ProductBatchesList productId={product.id} />
      </Card>
    </div>
  );
}

function SectionHeader({
  title,
  hint,
  editing,
  onEdit,
  onCancel,
  onSave,
  saveDisabled,
  trailing,
}: {
  title: string;
  hint: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  trailing?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
        <p className="mt-1 text-[12px] text-muted">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {editing ? (
          <>
            <Button variant="secondary" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onSave} disabled={saveDisabled}>
              {t("common.save")}
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            className="h-7 min-w-7 px-2"
            onClick={onEdit}
            aria-label={t("products.action.edit")}
            title={t("products.action.edit")}
          >
            ✎
          </Button>
        )}
      </div>
    </div>
  );
}

function ProductBatchesList({ productId }: { productId: string }) {
  const { data } = useStore();
  const { t, locale } = useI18n();
  const batches = data.batches
    .filter((b) => b.productId === productId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (batches.length === 0) {
    return (
      <p className="mt-4 text-[13px] text-muted">
        {t("productDetail.batchesEmpty")}
      </p>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-line rounded-[10px] border border-line">
      {batches.map((batch) => (
        <li key={batch.id}>
          <Link
            href={`/batches/${batch.id}`}
            className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] hover:bg-surface-faint"
          >
            <span className="font-medium text-foreground">
              {batch.label || batch.id}
            </span>
            <span className="tabular-nums text-muted">
              {batch.quantity}
              {" · "}
              {new Date(batch.createdAt).toLocaleDateString(locale)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DetailField({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-[14px] ${
          emphasize
            ? "font-semibold tabular-nums text-foreground"
            : "text-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function BomSortTh({
  label,
  active,
  dir,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th
      className={`px-4 py-2.5 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
          active ? "text-foreground" : "text-muted-soft"
        } ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}
        <span className="text-[10px] tabular-nums" aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function BomEmptyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="12"
        y="3"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="3"
        y="12"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M12 15.5h7M15.5 12v7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type {
  AppData,
  CatalogProduct,
  CatalogProductStatus,
  Component,
  PricingUnit,
  ProductComponent,
  ProductDocument,
  ProductRoutingStep,
  RoutingRateType,
} from "@/lib/types";
import { CURRENCIES, MAX_PRODUCT_DOCUMENTS } from "@/lib/types";
import { createId, formatEuro } from "@/lib/format";
import {
  catalogProductUnitPurchaseCost,
  emptyComponent,
  emptyProductComponent,
  emptyProductDocument,
  emptyProductRoutingStep,
} from "@/lib/migrateAppData";
import { estimateRoutingCostPerUnit } from "@/lib/production";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/context/PreferencesContext";
import { isCosterraWholesale } from "@/lib/costerraMode";
import {
  Button,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";

export function emptyCatalogProduct(): CatalogProduct {
  return {
    id: createId("cat"),
    name: "",
    sku: "",
    listPrice: null,
    pricingUnit: "pcs",
    currency: "EUR",
    status: "active",
    category: "",
    targetMarginPercent: null,
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "",
    documents: [],
    routingSteps: [],
    createdAt: new Date().toISOString(),
  };
}

type BomLine = {
  component: Component;
  link: ProductComponent;
};

type Props = {
  open: boolean;
  initial: CatalogProduct | null;
  isEdit: boolean;
  data: AppData;
  onClose: () => void;
  onSave: (
    product: CatalogProduct,
    components: Component[],
    links: ProductComponent[],
  ) => void;
};

export function CatalogProductFormModal({
  open,
  initial,
  isEdit,
  data,
  onClose,
  onSave,
}: Props) {
  const { t, pricingUnitLabel, pricingUnits, locale } = useI18n();
  const { prefs } = usePrefs();
  const wholesale = isCosterraWholesale(prefs);
  const [draft, setDraft] = useState<CatalogProduct | null>(() =>
    initial ? structuredClone(initial) : null,
  );
  const [lines, setLines] = useState<BomLine[]>([]);

  useLayoutEffect(() => {
    if (!open) {
      setDraft(null);
      setLines([]);
      return;
    }
    if (initial) {
      setDraft(
        structuredClone({
          ...initial,
          documents: initial.documents ?? [],
          routingSteps: initial.routingSteps ?? [],
        }),
      );
      const links = (data.productComponents ?? []).filter(
        (pc) => pc.productId === initial.id,
      );
      setLines(
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
    } else {
      setDraft(null);
      setLines([]);
    }
  }, [open, initial, data.components, data.productComponents]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const unitPurchase = useMemo(() => {
    if (!draft) return 0;
    return catalogProductUnitPurchaseCost(
      draft.id,
      lines.map((l) => l.component),
      lines.map((l) => ({ ...l.link, productId: draft.id })),
    );
  }, [draft, lines]);

  const title = isEdit
    ? t("productModal.editTitle")
    : t("productModal.createTitle");

  if (!open) return null;

  if (!draft) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        <p className="text-[13px] text-muted">{t("productModal.noDraft")}</p>
      </Modal>
    );
  }

  function handleSave() {
    if (!draft || !draft.name.trim() || !draft.sku.trim()) return;
    const documents = (draft.documents ?? [])
      .filter((d) => d.title.trim() || d.url.trim() || d.notes.trim())
      .slice(0, MAX_PRODUCT_DOCUMENTS)
      .map((d) => ({
        ...d,
        title: d.title.trim(),
        url: d.url.trim(),
        notes: d.notes.trim(),
      }));
    const routingSteps = (draft.routingSteps ?? [])
      .filter(
        (s) =>
          s.name.trim() ||
          s.setupMinutes > 0 ||
          s.runMinutesPerUnit > 0 ||
          s.hourlyRate > 0,
      )
      .map((s, index) => ({
        ...s,
        name: s.name.trim() || t("productDetail.routingCol.step"),
        sortOrder: index,
        setupMinutes: Math.max(s.setupMinutes, 0),
        runMinutesPerUnit: Math.max(s.runMinutesPerUnit, 0),
        hourlyRate: Math.max(s.hourlyRate, 0),
      }));
    const product: CatalogProduct = {
      ...draft,
      name: draft.name.trim(),
      sku: draft.sku.trim(),
      category: draft.category.trim(),
      notes: draft.notes.trim(),
      documents,
      routingSteps,
    };
    const kept = lines.filter(
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
      scrapRate: Math.min(Math.max(l.link.scrapRate ?? 0, 0), 0.95),
    }));
    onSave(product, components, links);
    onClose();
  }

  function addComponent() {
    const component = emptyComponent();
    setLines((prev) => [
      ...prev,
      {
        component,
        link: emptyProductComponent(draft!.id, component.id),
      },
    ]);
  }

  function addDocument() {
    setDraft((prev) => {
      if (!prev) return prev;
      const docs = prev.documents ?? [];
      if (docs.length >= MAX_PRODUCT_DOCUMENTS) return prev;
      return { ...prev, documents: [...docs, emptyProductDocument()] };
    });
  }

  function updateDocument(id: string, patch: Partial<ProductDocument>) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: (prev.documents ?? []).map((d) =>
          d.id === id ? { ...d, ...patch } : d,
        ),
      };
    });
  }

  function removeDocument(id: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: (prev.documents ?? []).filter((d) => d.id !== id),
      };
    });
  }

  function addRoutingStep() {
    setDraft((prev) => {
      if (!prev) return prev;
      const steps = prev.routingSteps ?? [];
      return {
        ...prev,
        routingSteps: [...steps, emptyProductRoutingStep(steps.length)],
      };
    });
  }

  function updateRoutingStep(id: string, patch: Partial<ProductRoutingStep>) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        routingSteps: (prev.routingSteps ?? []).map((s) =>
          s.id === id ? { ...s, ...patch } : s,
        ),
      };
    });
  }

  function removeRoutingStep(id: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        routingSteps: (prev.routingSteps ?? []).filter((s) => s.id !== id),
      };
    });
  }

  function moveRoutingStep(id: string, direction: -1 | 1) {
    setDraft((prev) => {
      if (!prev) return prev;
      const steps = [...(prev.routingSteps ?? [])];
      const index = steps.findIndex((s) => s.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= steps.length) return prev;
      const tmp = steps[index];
      steps[index] = steps[next];
      steps[next] = tmp;
      return {
        ...prev,
        routingSteps: steps.map((s, i) => ({ ...s, sortOrder: i })),
      };
    });
  }

  function updateLine(
    linkId: string,
    patch: { component?: Partial<Component>; link?: Partial<ProductComponent> },
  ) {
    setLines((prev) =>
      prev.map((row) =>
        row.link.id === linkId
          ? {
              component: { ...row.component, ...patch.component },
              link: { ...row.link, ...patch.link },
            }
          : row,
      ),
    );
  }

  function removeLine(linkId: string) {
    setLines((prev) => prev.filter((row) => row.link.id !== linkId));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={t("productModal.description")}
      wide
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("productModal.name")} required>
            <TextInput
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t("productModal.namePlaceholder")}
            />
          </Field>
          <Field label={t("productModal.sku")} required>
            <TextInput
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
              placeholder={t("productModal.skuPlaceholder")}
            />
          </Field>
          <Field
            label={t("productModal.pricingUnit")}
            hint={t("productModal.pricingUnitHint")}
          >
            <Select
              value={draft.pricingUnit}
              onChange={(e) =>
                setDraft({
                  ...draft,
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
          <Field label={t("productModal.currency")}>
            <Select
              value={draft.currency}
              onChange={(e) =>
                setDraft({ ...draft, currency: e.target.value })
              }
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("productModal.listPrice")}>
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={draft.listPrice ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  listPrice:
                    e.target.value === "" ? null : Number(e.target.value) || 0,
                })
              }
              placeholder="0.00"
            />
          </Field>
          <Field label={t("productModal.status")}>
            <Select
              value={draft.status}
              onChange={(e) =>
                setDraft({
                  ...draft,
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

        {!wholesale ? (
        <>
        <div className="rounded-[10px] border border-line p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-foreground">
                {t("productModal.componentsTitle")}
              </p>
              <p className="text-[12px] text-muted">
                {t("productModal.componentsHint")}
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={addComponent}>
              {t("productModal.addComponent")}
            </Button>
          </div>

          {lines.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-muted">
              {t("productModal.componentsEmpty")}
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((row) => (
                <div
                  key={row.link.id}
                  className="grid gap-2 rounded-[8px] border border-line bg-white p-2 sm:grid-cols-[1.1fr_0.9fr_0.55fr_0.55fr_0.5fr_auto]"
                >
                  <TextInput
                    value={row.component.name}
                    onChange={(e) =>
                      updateLine(row.link.id, {
                        component: { name: e.target.value },
                      })
                    }
                    placeholder={t("productModal.componentName")}
                  />
                  <Select
                    value={row.component.supplierId}
                    onChange={(e) => {
                      const supplierId = e.target.value;
                      updateLine(row.link.id, {
                        component: {
                          supplierId,
                          currency: supplierId
                            ? null
                            : row.component.currency ?? "EUR",
                        },
                      });
                    }}
                  >
                    <option value="">
                      {t("productModal.componentSupplier")}
                    </option>
                    {[...data.suppliers]
                      .sort((a, b) => a.name.localeCompare(b.name, locale))
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
                      updateLine(row.link.id, {
                        component: {
                          purchasePricePerUnit: Number(e.target.value) || 0,
                        },
                      })
                    }
                    placeholder={t("productModal.componentPrice")}
                  />
                  <TextInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.link.quantityPerProductUnit || ""}
                    onChange={(e) =>
                      updateLine(row.link.id, {
                        link: {
                          quantityPerProductUnit: Number(e.target.value) || 0,
                        },
                      })
                    }
                    placeholder={t("productModal.componentQty")}
                  />
                  <TextInput
                    type="number"
                    step="0.1"
                    min="0"
                    max="95"
                    value={
                      Math.round((row.link.scrapRate ?? 0) * 1000) / 10 || ""
                    }
                    onChange={(e) =>
                      updateLine(row.link.id, {
                        link: {
                          scrapRate: Math.min(
                            Math.max(Number(e.target.value) || 0, 0),
                            95,
                          ) / 100,
                        },
                      })
                    }
                    placeholder={t("productModal.componentScrap")}
                    title={t("productModal.componentScrap")}
                  />
                  <Button
                    type="button"
                    variant="danger"
                    className="h-9 px-2"
                    onClick={() => removeLine(row.link.id)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[13px] font-medium tabular-nums text-foreground">
            {t("productModal.computedPurchase")}:{" "}
            {formatEuro(unitPurchase, locale)}
            <span className="ml-1 text-[11px] font-normal text-muted-soft">
              / {pricingUnitLabel(draft.pricingUnit)}
            </span>
          </p>
        </div>

        <div className="rounded-[10px] border border-line p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-foreground">
                {t("productDetail.routingTitle")}
              </p>
              <p className="text-[12px] text-muted">
                {t("productModal.routingHint")}
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={addRoutingStep}>
              {t("productModal.addRoutingStep")}
            </Button>
          </div>

          {(draft.routingSteps ?? []).length === 0 ? (
            <p className="py-3 text-center text-[12px] text-muted">
              {t("productDetail.routingEmptyHint")}
            </p>
          ) : (
            <div className="space-y-2">
              {(draft.routingSteps ?? []).map((step, index) => (
                <div
                  key={step.id}
                  className="grid gap-2 rounded-[8px] border border-line bg-white p-2 sm:grid-cols-[1.2fr_0.65fr_0.65fr_0.65fr_0.85fr_auto]"
                >
                  <TextInput
                    value={step.name}
                    onChange={(e) =>
                      updateRoutingStep(step.id, { name: e.target.value })
                    }
                    placeholder={t("productDetail.routingCol.step")}
                  />
                  <TextInput
                    type="number"
                    step="0.1"
                    min="0"
                    value={step.setupMinutes || ""}
                    onChange={(e) =>
                      updateRoutingStep(step.id, {
                        setupMinutes: Number(e.target.value) || 0,
                      })
                    }
                    placeholder={t("productDetail.routingCol.setup")}
                    title={t("productDetail.routingCol.setup")}
                  />
                  <TextInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={step.runMinutesPerUnit || ""}
                    onChange={(e) =>
                      updateRoutingStep(step.id, {
                        runMinutesPerUnit: Number(e.target.value) || 0,
                      })
                    }
                    placeholder={t("productDetail.routingCol.run")}
                    title={t("productDetail.routingCol.run")}
                  />
                  <TextInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={step.hourlyRate || ""}
                    onChange={(e) =>
                      updateRoutingStep(step.id, {
                        hourlyRate: Number(e.target.value) || 0,
                      })
                    }
                    placeholder={t("productDetail.routingCol.rate")}
                    title={t("productDetail.routingCol.rate")}
                  />
                  <Select
                    value={step.rateType}
                    onChange={(e) =>
                      updateRoutingStep(step.id, {
                        rateType: e.target.value as RoutingRateType,
                      })
                    }
                  >
                    <option value="labor">{t("routing.rateType.labor")}</option>
                    <option value="machine">
                      {t("routing.rateType.machine")}
                    </option>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 px-2"
                      disabled={index === 0}
                      onClick={() => moveRoutingStep(step.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 px-2"
                      disabled={
                        index === (draft.routingSteps ?? []).length - 1
                      }
                      onClick={() => moveRoutingStep(step.id, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="h-9 px-2"
                      onClick={() => removeRoutingStep(step.id)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(draft.routingSteps ?? []).length > 0 ? (
            <p className="mt-3 text-[13px] font-medium tabular-nums text-foreground">
              {t("productDetail.routingTotal")}:{" "}
              {formatEuro(
                estimateRoutingCostPerUnit(draft.routingSteps ?? [], 100),
                locale,
              )}
              <span className="ml-1 text-[11px] font-normal text-muted-soft">
                {t("productDetail.routingLotHint", { qty: "100" })}
              </span>
            </p>
          ) : null}
        </div>
        </>
        ) : null}

        <div className="rounded-[10px] border border-line p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-foreground">
                {t("productModal.documentsTitle")}
              </p>
              <p className="text-[12px] text-muted">
                {t("productModal.documentsHint", {
                  max: String(MAX_PRODUCT_DOCUMENTS),
                })}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={addDocument}
              disabled={(draft.documents ?? []).length >= MAX_PRODUCT_DOCUMENTS}
            >
              {t("productModal.addDocument")}
            </Button>
          </div>

          {(draft.documents ?? []).length === 0 ? (
            <p className="py-3 text-center text-[12px] text-muted">
              {t("productModal.documentsEmpty")}
            </p>
          ) : (
            <div className="space-y-2">
              {(draft.documents ?? []).map((doc) => (
                <div
                  key={doc.id}
                  className="grid gap-2 rounded-[8px] border border-line bg-white p-2 sm:grid-cols-[1fr_1.2fr_auto]"
                >
                  <TextInput
                    value={doc.title}
                    onChange={(e) =>
                      updateDocument(doc.id, { title: e.target.value })
                    }
                    placeholder={t("productModal.documentTitle")}
                  />
                  <TextInput
                    value={doc.url}
                    onChange={(e) =>
                      updateDocument(doc.id, { url: e.target.value })
                    }
                    placeholder={t("productModal.documentUrl")}
                  />
                  <Button
                    type="button"
                    variant="danger"
                    className="h-9 px-2"
                    onClick={() => removeDocument(doc.id)}
                  >
                    ×
                  </Button>
                  <TextInput
                    className="sm:col-span-3"
                    value={doc.notes}
                    onChange={(e) =>
                      updateDocument(doc.id, { notes: e.target.value })
                    }
                    placeholder={t("productModal.documentNotes")}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label={t("productModal.notes")}>
          <TextArea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder={t("productModal.notesPlaceholder")}
            rows={3}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!draft.name.trim() || !draft.sku.trim()}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

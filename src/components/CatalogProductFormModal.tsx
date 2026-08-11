"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type {
  AppData,
  CatalogProduct,
  CatalogProductStatus,
  Component,
  PricingUnit,
} from "@/lib/types";
import { CURRENCIES } from "@/lib/types";
import { createId, formatEuro } from "@/lib/format";
import {
  catalogProductUnitPurchaseCost,
  emptyComponent,
} from "@/lib/migrateAppData";
import { useI18n } from "@/hooks/useI18n";
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
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

type Props = {
  open: boolean;
  initial: CatalogProduct | null;
  isEdit: boolean;
  data: AppData;
  onClose: () => void;
  onSave: (product: CatalogProduct, components: Component[]) => void;
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
  const [draft, setDraft] = useState<CatalogProduct | null>(() =>
    initial ? structuredClone(initial) : null,
  );
  const [components, setComponents] = useState<Component[]>([]);

  useLayoutEffect(() => {
    if (!open) {
      setDraft(null);
      setComponents([]);
      return;
    }
    if (initial) {
      setDraft(structuredClone(initial));
      setComponents(
        structuredClone(
          data.components.filter((c) => c.productId === initial.id),
        ),
      );
    } else {
      setDraft(null);
      setComponents([]);
    }
  }, [open, initial, data.components]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const unitPurchase = useMemo(
    () =>
      draft
        ? catalogProductUnitPurchaseCost(draft.id, components)
        : 0,
    [draft, components],
  );

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
    if (!draft || !draft.name.trim()) return;
    const product: CatalogProduct = {
      ...draft,
      name: draft.name.trim(),
      sku: draft.sku.trim(),
      category: draft.category.trim(),
      notes: draft.notes.trim(),
    };
    const nextComponents = components
      .filter((c) => c.name.trim() || c.purchasePricePerUnit > 0)
      .map((c) => ({
        ...c,
        productId: product.id,
        name: c.name.trim() || t("productModal.componentDefaultName"),
      }));
    onSave(product, nextComponents);
    onClose();
  }

  function addComponent() {
    setComponents((prev) => [...prev, emptyComponent(draft!.id)]);
  }

  function updateComponent(id: string, patch: Partial<Component>) {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function removeComponent(id: string) {
    setComponents((prev) => prev.filter((c) => c.id !== id));
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
          <Field label={t("productModal.sku")}>
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
                  {pricingUnitLabel(u, true)} ({pricingUnitLabel(u)})
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("productModal.listPrice", {
              unit: pricingUnitLabel(draft.pricingUnit),
            })}
            hint={t("productModal.listPriceHint")}
          >
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={draft.listPrice ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  listPrice:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder={t("productModal.listPricePlaceholder")}
            />
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
              <option value="inactive">{t("products.status.inactive")}</option>
            </Select>
          </Field>
          <Field label={t("productModal.category")}>
            <TextInput
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value })
              }
              placeholder={t("productModal.categoryPlaceholder")}
            />
          </Field>
          <Field
            label={t("productModal.targetMargin")}
            hint={t("productModal.targetMarginHint")}
          >
            <TextInput
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={draft.targetMarginPercent ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  targetMarginPercent:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder={t("productModal.targetMarginPlaceholder")}
            />
          </Field>
        </div>

        <div className="rounded-[10px] border border-line bg-surface-faint p-3">
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

          {components.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-muted">
              {t("productModal.componentsEmpty")}
            </p>
          ) : (
            <div className="space-y-2">
              {components.map((c) => (
                <div
                  key={c.id}
                  className="grid gap-2 rounded-[8px] border border-line bg-white p-2 sm:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_auto]"
                >
                  <TextInput
                    value={c.name}
                    onChange={(e) =>
                      updateComponent(c.id, { name: e.target.value })
                    }
                    placeholder={t("productModal.componentName")}
                  />
                  <Select
                    value={c.supplierId}
                    onChange={(e) =>
                      updateComponent(c.id, { supplierId: e.target.value })
                    }
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
                    value={c.purchasePricePerUnit || ""}
                    onChange={(e) =>
                      updateComponent(c.id, {
                        purchasePricePerUnit: Number(e.target.value) || 0,
                      })
                    }
                    placeholder={t("productModal.componentPrice")}
                  />
                  <TextInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={c.quantityPerProductUnit || ""}
                    onChange={(e) =>
                      updateComponent(c.id, {
                        quantityPerProductUnit: Number(e.target.value) || 0,
                      })
                    }
                    placeholder={t("productModal.componentQty")}
                  />
                  <Button
                    type="button"
                    variant="danger"
                    className="h-9 px-2"
                    onClick={() => removeComponent(c.id)}
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
          <Button onClick={handleSave} disabled={!draft.name.trim()}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

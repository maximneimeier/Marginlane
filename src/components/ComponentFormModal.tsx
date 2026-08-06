"use client";

import { useEffect, useState } from "react";
import type { DiscountTier, PricingUnit, Product, Supplier } from "@/lib/types";
import { createId } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { emptyCommercialOverrides, resolveCommercial } from "@/lib/resolve";
import {
  CommercialOverridesEditor,
  pickCommercialOverrides,
} from "@/components/CommercialOverridesEditor";
import {
  Button,
  Field,
  Modal,
  Select,
  TextInput,
} from "@/components/ui";

export function emptyComponent(supplierId = ""): Product {
  return {
    id: createId("prd"),
    supplierId,
    name: "",
    sku: "",
    unitPrice: 0,
    moq: 0,
    discountTiers: [],
    pricingUnit: "pcs",
    ...emptyCommercialOverrides(),
    createdAt: new Date().toISOString(),
  };
}

type Props = {
  open: boolean;
  initial: Product | null;
  suppliers: Supplier[];
  isEdit: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  /** Wenn true: Lieferant ist fix und nicht wählbar */
  lockSupplier?: boolean;
};

export function ComponentFormModal({
  open,
  initial,
  suppliers,
  isEdit,
  onClose,
  onSave,
  lockSupplier = false,
}: Props) {
  const { t, pricingUnitLabel, pricingUnits } = useI18n();
  const [draft, setDraft] = useState<Product | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ? structuredClone(initial) : null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const title = isEdit
    ? t("componentModal.editTitle")
    : t("componentModal.createTitle");

  if (!draft) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        <p className="text-[13px] text-muted">{t("componentModal.noDraft")}</p>
      </Modal>
    );
  }

  const supplier = suppliers.find((s) => s.id === draft.supplierId);
  const inherited = resolveCommercial(supplier, null, null);
  const commercial = resolveCommercial(supplier, draft, null);

  function updateTier(index: number, patch: Partial<DiscountTier>) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        discountTiers: prev.discountTiers.map((tier, i) =>
          i === index ? { ...tier, ...patch } : tier,
        ),
      };
    });
  }

  function handleSave() {
    if (!draft || !draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim(), supplierId: draft.supplierId || "" });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={t("componentModal.description")}
      wide
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t("componentModal.supplier")}
            hint={t("componentModal.supplierOptionalHint")}
          >
            <Select
              value={draft.supplierId}
              onChange={(e) =>
                setDraft({ ...draft, supplierId: e.target.value })
              }
              disabled={lockSupplier}
            >
              <option value="">{t("componentModal.supplierNone")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("componentModal.name")} required>
            <TextInput
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t("componentModal.namePlaceholder")}
            />
          </Field>
          <Field label={t("componentModal.sku")}>
            <TextInput
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
              placeholder={t("componentModal.skuPlaceholder")}
            />
          </Field>
          <Field
            label={t("componentModal.pricingUnit")}
            hint={t("componentModal.pricingUnitHint")}
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
            label={t("componentModal.unitPrice", {
              unit: pricingUnitLabel(draft.pricingUnit),
            })}
          >
            <TextInput
              type="number"
              step="0.0001"
              min="0"
              value={draft.unitPrice || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  unitPrice: Number(e.target.value) || 0,
                })
              }
              placeholder="0.00"
            />
          </Field>
          <Field
            label={t("unit.moqLabel", {
              unit: pricingUnitLabel(draft.pricingUnit),
            })}
          >
            <TextInput
              type="number"
              min="0"
              value={draft.moq || ""}
              onChange={(e) =>
                setDraft({ ...draft, moq: Number(e.target.value) || 0 })
              }
              placeholder={t("componentModal.moqPlaceholder")}
            />
          </Field>
        </div>

        <CommercialOverridesEditor
          value={pickCommercialOverrides(draft)}
          inherited={inherited}
          resolved={commercial}
          parentLabel={
            supplier?.name ?? t("componentModal.defaultTermsParent")
          }
          onChange={(next) => setDraft({ ...draft, ...next })}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-medium text-muted">
              {t("componentModal.tiers")}
            </p>
            <Button
              variant="ghost"
              onClick={() =>
                setDraft({
                  ...draft,
                  discountTiers: [
                    ...draft.discountTiers,
                    { minQty: 0, discountPercent: 0 },
                  ],
                })
              }
            >
              {t("componentModal.addTier")}
            </Button>
          </div>
          {draft.discountTiers.length === 0 ? (
            <p className="text-[13px] text-muted-soft">
              {t("componentModal.noTiers")}
            </p>
          ) : (
            <ul className="space-y-2">
              {draft.discountTiers.map((tier, i) => (
                <li key={i} className="flex flex-wrap items-end gap-2">
                  <Field label={t("componentModal.tierMinQty")}>
                    <TextInput
                      type="number"
                      value={tier.minQty || ""}
                      onChange={(e) =>
                        updateTier(i, {
                          minQty: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </Field>
                  <Field label={t("componentModal.tierDiscount")}>
                    <TextInput
                      type="number"
                      step="0.1"
                      value={tier.discountPercent || ""}
                      onChange={(e) =>
                        updateTier(i, {
                          discountPercent: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </Field>
                  <Button
                    variant="danger"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        discountTiers: draft.discountTiers.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("common.save")}</Button>
        </div>
      </div>
    </Modal>
  );
}

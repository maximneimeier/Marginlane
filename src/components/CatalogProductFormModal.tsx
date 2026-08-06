"use client";

import { useEffect, useState } from "react";
import type {
  CatalogProduct,
  CatalogProductStatus,
  PricingUnit,
} from "@/lib/types";
import { CURRENCIES } from "@/lib/types";
import { createId } from "@/lib/format";
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
    sellPrice: 0,
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
  onClose: () => void;
  onSave: (product: CatalogProduct) => void;
};

export function CatalogProductFormModal({
  open,
  initial,
  isEdit,
  onClose,
  onSave,
}: Props) {
  const { t, pricingUnitLabel, pricingUnits } = useI18n();
  const [draft, setDraft] = useState<CatalogProduct | null>(null);

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
    ? t("productModal.editTitle")
    : t("productModal.createTitle");

  if (!draft) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        <p className="text-[13px] text-muted">{t("productModal.noDraft")}</p>
      </Modal>
    );
  }

  function handleSave() {
    if (!draft || !draft.name.trim()) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      sku: draft.sku.trim(),
      category: draft.category.trim(),
      notes: draft.notes.trim(),
    });
    onClose();
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
            label={t("productModal.sellPrice", {
              unit: pricingUnitLabel(draft.pricingUnit),
            })}
            required
          >
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={draft.sellPrice || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sellPrice:
                    e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
              placeholder={t("productModal.sellPricePlaceholder")}
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

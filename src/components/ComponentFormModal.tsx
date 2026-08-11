"use client";

import { useLayoutEffect, useEffect, useState } from "react";
import type { AppData, Component } from "@/lib/types";
import { emptyComponent as createEmptyComponent } from "@/lib/migrateAppData";
import { useI18n } from "@/hooks/useI18n";
import {
  Button,
  Field,
  Modal,
  Select,
  TextInput,
} from "@/components/ui";

export function emptyBomComponent(
  productId = "",
  supplierId = "",
): Component {
  return createEmptyComponent(productId, supplierId);
}

type Props = {
  open: boolean;
  initial: Component | null;
  data: AppData;
  isEdit: boolean;
  onClose: () => void;
  onSave: (component: Component) => void;
};

export function ComponentFormModal({
  open,
  initial,
  data,
  isEdit,
  onClose,
  onSave,
}: Props) {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<Component | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    setDraft(
      initial
        ? structuredClone(initial)
        : emptyBomComponent(
            data.catalogProducts[0]?.id ?? "",
            data.suppliers[0]?.id ?? "",
          ),
    );
  }, [open, initial, data.catalogProducts, data.suppliers]);

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

  function handleSave() {
    if (!draft || !draft.name.trim() || !draft.productId) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      quantityPerProductUnit: Math.max(draft.quantityPerProductUnit, 0),
      purchasePricePerUnit: Math.max(draft.purchasePricePerUnit, 0),
    });
    onClose();
  }

  const canSave = Boolean(draft.name.trim() && draft.productId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={t("componentModal.bomDescription")}
    >
      <div className="space-y-4">
        <Field label={t("componentModal.product")} required>
          <Select
            value={draft.productId}
            onChange={(e) =>
              setDraft({ ...draft, productId: e.target.value })
            }
          >
            <option value="">{t("componentModal.productPlaceholder")}</option>
            {[...data.catalogProducts]
              .sort((a, b) => a.name.localeCompare(b.name, locale))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ""}
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

        <Field
          label={t("componentModal.supplier")}
          hint={t("componentModal.supplierOptionalHint")}
        >
          <Select
            value={draft.supplierId}
            onChange={(e) =>
              setDraft({ ...draft, supplierId: e.target.value })
            }
          >
            <option value="">{t("componentModal.supplierNone")}</option>
            {[...data.suppliers]
              .sort((a, b) => a.name.localeCompare(b.name, locale))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("componentModal.purchasePrice")} required>
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={draft.purchasePricePerUnit || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  purchasePricePerUnit: Number(e.target.value) || 0,
                })
              }
              placeholder="0.00"
            />
          </Field>
          <Field
            label={t("componentModal.qtyPerProduct")}
            hint={t("componentModal.qtyPerProductHint")}
          >
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={draft.quantityPerProductUnit || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  quantityPerProductUnit: Number(e.target.value) || 0,
                })
              }
              placeholder="1"
            />
          </Field>
        </div>

        {data.catalogProducts.length === 0 ? (
          <p className="rounded-[8px] border border-dashed border-line px-3 py-2 text-[12px] text-muted">
            {t("componentModal.needProduct")}
          </p>
        ) : null}

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

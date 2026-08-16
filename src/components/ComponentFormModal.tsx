"use client";

import { useLayoutEffect, useEffect, useMemo, useState } from "react";
import type { AppData, Component, ProductComponent } from "@/lib/types";
import { CURRENCIES } from "@/lib/types";
import {
  emptyComponent as createEmptyComponent,
  emptyProductComponent,
} from "@/lib/migrateAppData";
import {
  resolveComponentCurrency,
  WORKSPACE_DEFAULT_CURRENCY,
} from "@/lib/resolve";
import { useI18n } from "@/hooks/useI18n";
import {
  Button,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";

export function emptyBomComponent(supplierId = ""): Component {
  return createEmptyComponent(supplierId);
}

export type ComponentFormSave = {
  mode: "create" | "link";
  component: Component;
  link: ProductComponent;
};

type Props = {
  open: boolean;
  initial: Component | null;
  data: AppData;
  isEdit: boolean;
  onClose: () => void;
  onSave: (result: ComponentFormSave) => void;
};

type FormMode = "create" | "link";

export function ComponentFormModal({
  open,
  initial,
  data,
  isEdit,
  onClose,
  onSave,
}: Props) {
  const { t, locale } = useI18n();
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [draft, setDraft] = useState<Component | null>(null);
  const [existingId, setExistingId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [priceOverride, setPriceOverride] = useState<string>("");

  useLayoutEffect(() => {
    if (!open) return;
    if (initial) {
      setFormMode("create");
      setDraft(structuredClone(initial));
      setExistingId("");
      const existingLink = (data.productComponents ?? []).find(
        (pc) => pc.componentId === initial.id,
      );
      setProductId(existingLink?.productId ?? data.catalogProducts[0]?.id ?? "");
      setQuantity(existingLink?.quantityPerProductUnit ?? 1);
      setPriceOverride(
        existingLink?.purchasePriceOverride != null
          ? String(existingLink.purchasePriceOverride)
          : "",
      );
    } else {
      setFormMode("create");
      setDraft(emptyBomComponent(data.suppliers[0]?.id ?? ""));
      setExistingId("");
      setProductId(data.catalogProducts[0]?.id ?? "");
      setQuantity(1);
      setPriceOverride("");
    }
  }, [open, initial, data.catalogProducts, data.suppliers, data.productComponents]);

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

  const linkedSupplier = useMemo(() => {
    const supplierId =
      formMode === "link"
        ? data.components.find((c) => c.id === existingId)?.supplierId
        : draft?.supplierId;
    return supplierId
      ? data.suppliers.find((s) => s.id === supplierId)
      : undefined;
  }, [data.suppliers, data.components, draft?.supplierId, existingId, formMode]);

  const activeComponent =
    formMode === "link"
      ? data.components.find((c) => c.id === existingId)
      : draft;

  const currencyResolved = useMemo(
    () =>
      activeComponent
        ? resolveComponentCurrency(activeComponent, linkedSupplier)
        : {
            value: WORKSPACE_DEFAULT_CURRENCY,
            source: "none" as const,
          },
    [activeComponent, linkedSupplier],
  );

  if (!draft && formMode === "create") {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        <p className="text-[13px] text-muted">{t("componentModal.noDraft")}</p>
      </Modal>
    );
  }

  function setSupplier(supplierId: string) {
    if (!draft) return;
    if (supplierId) {
      setDraft({ ...draft, supplierId, currency: null });
    } else {
      setDraft({
        ...draft,
        supplierId: "",
        currency: draft.currency ?? WORKSPACE_DEFAULT_CURRENCY,
      });
    }
  }

  function handleSave() {
    const overrideRaw = priceOverride.trim();
    const purchasePriceOverride =
      overrideRaw === ""
        ? null
        : Math.max(Number(overrideRaw) || 0, 0);

    if (formMode === "link") {
      if (!existingId || !productId) return;
      const component = data.components.find((c) => c.id === existingId);
      if (!component) return;
      onSave({
        mode: "link",
        component,
        link: {
          ...emptyProductComponent(productId, existingId),
          quantityPerProductUnit: Math.max(quantity, 0),
          purchasePriceOverride,
        },
      });
      onClose();
      return;
    }

    if (!draft || !draft.name.trim()) return;
    const hasSupplier = Boolean(draft.supplierId);
    const component: Component = {
      ...draft,
      name: draft.name.trim(),
      sku: draft.sku.trim(),
      notes: draft.notes.trim(),
      currency: hasSupplier
        ? null
        : draft.currency || WORKSPACE_DEFAULT_CURRENCY,
      purchasePricePerUnit: Math.max(draft.purchasePricePerUnit, 0),
    };

    // Edit stamm without forcing a new link if no product chosen
    if (isEdit && !productId) {
      onSave({
        mode: "create",
        component,
        link: emptyProductComponent("", component.id),
      });
      onClose();
      return;
    }

    if (!productId) return;
    onSave({
      mode: "create",
      component,
      link: {
        ...emptyProductComponent(productId, component.id),
        quantityPerProductUnit: Math.max(quantity, 0),
        purchasePriceOverride,
      },
    });
    onClose();
  }

  const canSave =
    formMode === "link"
      ? Boolean(existingId && productId)
      : Boolean(
          draft?.name.trim() && (isEdit || productId),
        );

  const showManualCurrency =
    formMode === "create" && draft && !draft.supplierId;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={t("componentModal.bomDescription")}
    >
      <div className="space-y-4">
        {!isEdit ? (
          <div className="flex gap-1 rounded-[8px] border border-line bg-surface-faint p-0.5">
            <button
              type="button"
              onClick={() => setFormMode("create")}
              className={`flex-1 rounded-[6px] px-2.5 py-1.5 text-[12px] font-medium ${
                formMode === "create"
                  ? "bg-white text-foreground shadow-[var(--shadow-sm)]"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("componentModal.mode.create")}
            </button>
            <button
              type="button"
              onClick={() => setFormMode("link")}
              className={`flex-1 rounded-[6px] px-2.5 py-1.5 text-[12px] font-medium ${
                formMode === "link"
                  ? "bg-white text-foreground shadow-[var(--shadow-sm)]"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("componentModal.mode.link")}
            </button>
          </div>
        ) : null}

        {formMode === "link" && !isEdit ? (
          <Field label={t("componentModal.existing")} required>
            <Select
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
            >
              <option value="">{t("componentModal.existingPlaceholder")}</option>
              {[...data.components]
                .sort((a, b) => a.name.localeCompare(b.name, locale))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.sku ? ` (${c.sku})` : ""}
                  </option>
                ))}
            </Select>
          </Field>
        ) : (
          <>
            <Field label={t("componentModal.name")} required>
              <TextInput
                autoFocus
                value={draft?.name ?? ""}
                onChange={(e) =>
                  draft && setDraft({ ...draft, name: e.target.value })
                }
                placeholder={t("componentModal.namePlaceholder")}
              />
            </Field>

            <Field
              label={t("componentModal.componentSku")}
              hint={t("componentModal.componentSkuHint")}
            >
              <TextInput
                value={draft?.sku ?? ""}
                onChange={(e) =>
                  draft && setDraft({ ...draft, sku: e.target.value })
                }
                placeholder={t("componentModal.componentSkuPlaceholder")}
              />
            </Field>

            <Field
              label={t("componentModal.supplier")}
              hint={t("componentModal.supplierOptionalHint")}
            >
              <Select
                value={draft?.supplierId ?? ""}
                onChange={(e) => setSupplier(e.target.value)}
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

            <Field label={t("componentModal.purchasePrice")} required>
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={draft?.purchasePricePerUnit || ""}
                onChange={(e) =>
                  draft &&
                  setDraft({
                    ...draft,
                    purchasePricePerUnit: Number(e.target.value) || 0,
                  })
                }
                placeholder="0.00"
              />
            </Field>

            <Field label={t("products.col.hsCode")}>
              <TextInput
                value={draft?.hsCode ?? ""}
                onChange={(e) =>
                  draft && setDraft({ ...draft, hsCode: e.target.value })
                }
                placeholder="9401.61"
              />
            </Field>
            <Field label={t("products.col.countryOfOrigin")}>
              <TextInput
                value={draft?.countryOfOrigin ?? ""}
                onChange={(e) =>
                  draft &&
                  setDraft({ ...draft, countryOfOrigin: e.target.value })
                }
              />
            </Field>
            <Field label={t("products.col.dutyRate")}>
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={draft?.dutyRatePercent || ""}
                onChange={(e) =>
                  draft &&
                  setDraft({
                    ...draft,
                    dutyRatePercent: Number(e.target.value) || 0,
                  })
                }
              />
            </Field>

            <Field
              label={t("componentModal.moq")}
              hint={t("componentModal.moqPlaceholder")}
            >
              <TextInput
                type="number"
                min="0"
                value={draft?.moq || ""}
                onChange={(e) =>
                  draft &&
                  setDraft({
                    ...draft,
                    moq: Number(e.target.value) || 0,
                  })
                }
                placeholder={t("componentModal.moqPlaceholder")}
              />
            </Field>

            <Field label={t("componentModal.discountTiers")}>
              <div className="space-y-2">
                {(draft?.discountTiers ?? []).map((tier, idx) => (
                  <div key={idx} className="flex gap-2">
                    <TextInput
                      type="number"
                      min="0"
                      placeholder="Min qty"
                      value={tier.minQty || ""}
                      onChange={(e) => {
                        if (!draft) return;
                        const discountTiers = [...draft.discountTiers];
                        discountTiers[idx] = {
                          ...tier,
                          minQty: Number(e.target.value) || 0,
                        };
                        setDraft({ ...draft, discountTiers });
                      }}
                    />
                    <TextInput
                      type="number"
                      min="0"
                      max="100"
                      placeholder="%"
                      value={tier.discountPercent || ""}
                      onChange={(e) => {
                        if (!draft) return;
                        const discountTiers = [...draft.discountTiers];
                        discountTiers[idx] = {
                          ...tier,
                          discountPercent: Number(e.target.value) || 0,
                        };
                        setDraft({ ...draft, discountTiers });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (!draft) return;
                        setDraft({
                          ...draft,
                          discountTiers: draft.discountTiers.filter(
                            (_, i) => i !== idx,
                          ),
                        });
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    draft &&
                    setDraft({
                      ...draft,
                      discountTiers: [
                        ...draft.discountTiers,
                        { minQty: 100, discountPercent: 5 },
                      ],
                    })
                  }
                >
                  {t("componentModal.addTier")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!draft || draft.purchasePricePerUnit <= 0) return;
                    const currency =
                      draft.currency ||
                      linkedSupplier?.currency ||
                      WORKSPACE_DEFAULT_CURRENCY;
                    setDraft({
                      ...draft,
                      priceHistory: [
                        {
                          id: `cph_${Date.now()}`,
                          date: new Date().toISOString().slice(0, 10),
                          price: draft.purchasePricePerUnit,
                          currency,
                          note: "",
                        },
                        ...draft.priceHistory,
                      ],
                    });
                  }}
                >
                  {t("componentModal.snapshotPrice")}
                </Button>
                {(draft?.priceHistory ?? []).length > 0 ? (
                  <ul className="text-[12px] text-muted">
                    {draft!.priceHistory.slice(0, 5).map((h) => (
                      <li key={h.id}>
                        {h.date}: {h.price} {h.currency}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Field>

            {showManualCurrency ? (
              <Field
                label={t("componentModal.currency")}
                hint={t("componentModal.currencyManualHint")}
              >
                <Select
                  value={draft?.currency || WORKSPACE_DEFAULT_CURRENCY}
                  onChange={(e) =>
                    draft && setDraft({ ...draft, currency: e.target.value })
                  }
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : draft?.supplierId ? (
              <Field
                label={t("componentModal.currency")}
                hint={t("componentModal.currencyInheritedHint", {
                  currency: currencyResolved.value,
                  supplier: linkedSupplier?.name ?? "",
                })}
              >
                <TextInput value={currencyResolved.value} disabled readOnly />
              </Field>
            ) : null}

            <Field
              label={t("componentModal.notes")}
              hint={t("componentModal.notesHint")}
            >
              <TextArea
                value={draft?.notes ?? ""}
                onChange={(e) =>
                  draft && setDraft({ ...draft, notes: e.target.value })
                }
                placeholder={t("componentModal.notesPlaceholder")}
                rows={2}
              />
            </Field>
          </>
        )}

        <Field
          label={t("componentModal.product")}
          required={!isEdit || formMode === "link"}
          hint={
            isEdit
              ? t("componentModal.productOptionalEditHint")
              : undefined
          }
        >
          <Select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
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

        {productId ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t("componentModal.qtyPerProduct")}
              hint={t("componentModal.qtyPerProductHint")}
            >
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                placeholder="1"
              />
            </Field>
            <Field
              label={t("componentModal.priceOverride")}
              hint={t("componentModal.priceOverrideHint")}
            >
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={priceOverride}
                onChange={(e) => setPriceOverride(e.target.value)}
                placeholder={t("componentModal.priceOverridePlaceholder")}
              />
            </Field>
          </div>
        ) : null}

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

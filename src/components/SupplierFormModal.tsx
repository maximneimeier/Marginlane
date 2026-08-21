"use client";

import { useEffect, useState } from "react";
import type { PaymentUnit, Supplier, SupplierStatus } from "@/lib/types";
import {
  COUNTRIES,
  CURRENCIES,
  LEGAL_FORMS,
  formatPaymentTerms,
} from "@/lib/types";
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

export function emptySupplier(): Supplier {
  return {
    id: createId("sup"),
    name: "",
    country: "",
    contactName: "",
    email: "",
    phone: "",
    currency: "EUR",
    paymentDays: 30,
    paymentUnit: "Tage",
    skontoPercent: 0,
    skontoDays: 0,
    incoterm: "FOB",
    taxId: "",
    legalForm: "",
    website: "",
    originPort: "",
    leadTimeDays: 0,
    iban: "",
    certifications: "",
    status: "active",
    notes: "",
    paymentTerms: "30 Tage",
    createdAt: new Date().toISOString(),
  };
}

type Props = {
  open: boolean;
  initial?: Supplier | null;
  isEdit?: boolean;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
  onAddProduct?: (supplierId: string) => void;
};

export function SupplierFormModal({
  open,
  initial,
  isEdit = false,
  onClose,
  onSave,
  onAddProduct,
}: Props) {
  const { t, supplierStatusLabel, countryLabel } = useI18n();
  const [draft, setDraft] = useState<Supplier>(emptySupplier());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ? { ...initial } : emptySupplier());
    setAdvancedOpen(false);
    setErrors({});
    setSavedId(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function patch(update: Partial<Supplier>) {
    setDraft((prev) => {
      const next = { ...prev, ...update };
      next.paymentTerms = formatPaymentTerms(next);
      return next;
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!draft.name.trim()) next.name = t("common.required");
    if (!draft.country) next.country = t("common.required");
    if (!draft.contactName.trim()) next.contactName = t("common.required");
    if (!draft.email.trim()) next.email = t("common.required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      next.email = t("supplierModal.error.invalidEmail");
    }
    if (!draft.currency) next.currency = t("common.required");
    if (!draft.paymentDays || draft.paymentDays <= 0) {
      next.paymentDays = t("common.required");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const supplier: Supplier = {
      ...draft,
      name: draft.name.trim(),
      contactName: draft.contactName.trim(),
      email: draft.email.trim(),
      paymentTerms: formatPaymentTerms(draft),
    };
    onSave(supplier);
    if (isEdit) {
      onClose();
      return;
    }
    setSavedId(supplier.id);
  }

  if (savedId) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={t("supplierModal.savedTitle")}
        description={t("supplierModal.savedDescription", { name: draft.name })}
        wide
      >
        <div className="space-y-4 pb-1">
          <div className="rounded-[10px] border border-line bg-surface-faint px-4 py-3 text-[13px] text-muted">
            {t("supplierModal.savedHint")}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                onAddProduct?.(savedId);
                onClose();
              }}
            >
              {t("supplierModal.addProduct")}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              {t("supplierModal.later")}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEdit ? t("supplierModal.editTitle") : t("supplierModal.createTitle")
      }
      description={t("supplierModal.description")}
      wide
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
            {t("supplierModal.section.basic")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("supplierModal.companyName")} required>
              <TextInput
                autoFocus
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={t("supplierModal.companyNamePlaceholder")}
                className={errors.name ? "border-danger" : ""}
              />
            </Field>
            <Field label={t("supplierModal.country")} required>
              <Select
                value={draft.country}
                onChange={(e) => patch({ country: e.target.value })}
                className={errors.country ? "border-danger" : ""}
              >
                <option value="">{t("supplierModal.selectCountry")}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {countryLabel(c.code)} ({c.code})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("supplierModal.contactName")} required>
              <TextInput
                value={draft.contactName}
                onChange={(e) => patch({ contactName: e.target.value })}
                placeholder={t("supplierModal.contactNamePlaceholder")}
                className={errors.contactName ? "border-danger" : ""}
              />
            </Field>
            <Field label={t("supplierModal.email")} required>
              <TextInput
                type="email"
                value={draft.email}
                onChange={(e) => patch({ email: e.target.value })}
                placeholder={t("supplierModal.emailPlaceholder")}
                className={errors.email ? "border-danger" : ""}
              />
            </Field>
            <Field label={t("supplierModal.phone")}>
              <TextInput
                type="tel"
                value={draft.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder={t("supplierModal.phonePlaceholder")}
              />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
            {t("supplierModal.section.terms")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("supplierModal.currency")} required>
              <Select
                value={draft.currency}
                onChange={(e) => patch({ currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("supplierModal.paymentDays")} required>
              <div className="flex gap-2">
                <TextInput
                  type="number"
                  min="1"
                  value={draft.paymentDays || ""}
                  onChange={(e) =>
                    patch({ paymentDays: Number(e.target.value) || 0 })
                  }
                  className={`min-w-0 flex-[2.5] ${errors.paymentDays ? "border-danger" : ""}`}
                />
                <Select
                  value={draft.paymentUnit}
                  onChange={(e) =>
                    patch({ paymentUnit: e.target.value as PaymentUnit })
                  }
                  className="w-[96px] shrink-0"
                >
                  <option value="Tage">{t("paymentUnit.Tage")}</option>
                  <option value="Wochen">{t("paymentUnit.Wochen")}</option>
                </Select>
              </div>
            </Field>
          </div>
        </section>

        <section>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-[8px] border border-line bg-surface-faint px-3 py-2.5 text-left text-[13px] font-medium text-foreground hover:bg-surface-soft"
          >
            {t("supplierModal.section.advanced")}
            <span
              className={`text-muted-soft transition-transform ${
                advancedOpen ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </button>

          {advancedOpen ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t("supplierModal.taxId")}>
                <TextInput
                  value={draft.taxId}
                  onChange={(e) => patch({ taxId: e.target.value })}
                />
              </Field>
              <Field label={t("supplierModal.legalForm")}>
                <Select
                  value={draft.legalForm}
                  onChange={(e) => patch({ legalForm: e.target.value })}
                >
                  {LEGAL_FORMS.map((f) => (
                    <option key={f || "none"} value={f}>
                      {f === "Andere"
                        ? t("legalForm.Andere")
                        : f || t("common.emDash")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("supplierModal.website")}>
                <TextInput
                  value={draft.website}
                  onChange={(e) => patch({ website: e.target.value })}
                  placeholder={t("supplierModal.websitePlaceholder")}
                />
              </Field>
              <Field label={t("supplierModal.originPort")}>
                <TextInput
                  value={draft.originPort}
                  onChange={(e) => patch({ originPort: e.target.value })}
                  placeholder={t("supplierModal.originPortPlaceholder")}
                />
              </Field>
              <Field label={t("supplierModal.leadTimeDays")}>
                <TextInput
                  type="number"
                  min="0"
                  value={draft.leadTimeDays || ""}
                  onChange={(e) =>
                    patch({ leadTimeDays: Number(e.target.value) || 0 })
                  }
                />
              </Field>
              <Field label={t("supplierModal.iban")}>
                <TextInput
                  value={draft.iban}
                  onChange={(e) => patch({ iban: e.target.value })}
                />
              </Field>
              <Field label={t("supplierModal.certifications")}>
                <TextInput
                  value={draft.certifications}
                  onChange={(e) => patch({ certifications: e.target.value })}
                  placeholder={t("supplierModal.certificationsPlaceholder")}
                />
              </Field>
              <Field label={t("supplierModal.status")}>
                <Select
                  value={draft.status}
                  onChange={(e) =>
                    patch({ status: e.target.value as SupplierStatus })
                  }
                >
                  {(
                    ["active", "inactive", "review"] as SupplierStatus[]
                  ).map((key) => (
                    <option key={key} value={key}>
                      {supplierStatusLabel(key)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("supplierModal.notes")}>
                  <TextArea
                    value={draft.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    placeholder={t("supplierModal.notesPlaceholder")}
                  />
                </Field>
              </div>
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[12px] text-muted-soft">{t("common.requiredFields")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">
              {isEdit ? t("supplierModal.saveEdit") : t("supplierModal.saveCreate")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

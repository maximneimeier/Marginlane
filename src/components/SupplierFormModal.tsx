"use client";

import { useEffect, useState } from "react";
import type { PaymentUnit, Supplier, SupplierStatus } from "@/lib/types";
import {
  COUNTRIES,
  CURRENCIES,
  INCOTERMS,
  LEGAL_FORMS,
  SUPPLIER_STATUS_LABELS,
  formatPaymentTerms,
} from "@/lib/types";
import { createId } from "@/lib/format";
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
    if (!draft.name.trim()) next.name = "Pflichtfeld";
    if (!draft.country) next.country = "Pflichtfeld";
    if (!draft.contactName.trim()) next.contactName = "Pflichtfeld";
    if (!draft.email.trim()) next.email = "Pflichtfeld";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      next.email = "Ungültige E-Mail";
    }
    if (!draft.currency) next.currency = "Pflichtfeld";
    if (!draft.paymentDays || draft.paymentDays <= 0) {
      next.paymentDays = "Pflichtfeld";
    }
    if (!draft.incoterm) next.incoterm = "Pflichtfeld";
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
        title="Lieferant angelegt"
        description={`${draft.name} wurde gespeichert.`}
        wide
      >
        <div className="space-y-4 pb-1">
          <div className="rounded-[10px] border border-line bg-surface-faint px-4 py-3 text-[13px] text-muted">
            Als Nächstes kannst du Preise, MOQ und Rabattstaffeln hinterlegen.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                onAddProduct?.(savedId);
                onClose();
              }}
            >
              + Produkt hinzufügen
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Später
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
      title={isEdit ? "Lieferant bearbeiten" : "Neuen Lieferanten anlegen"}
      description="Basis und Konditionen reichen für den Start — Erweitertes ist optional."
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
            Basis
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Firmenname" required>
              <TextInput
                autoFocus
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="z. B. Muster GmbH"
                className={errors.name ? "border-danger" : ""}
              />
            </Field>
            <Field label="Land" required>
              <Select
                value={draft.country}
                onChange={(e) => patch({ country: e.target.value })}
                className={errors.country ? "border-danger" : ""}
              >
                <option value="">Land wählen…</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ansprechpartner" required>
              <TextInput
                value={draft.contactName}
                onChange={(e) => patch({ contactName: e.target.value })}
                placeholder="Vor- und Nachname"
                className={errors.contactName ? "border-danger" : ""}
              />
            </Field>
            <Field label="E-Mail" required>
              <TextInput
                type="email"
                value={draft.email}
                onChange={(e) => patch({ email: e.target.value })}
                placeholder="orders@lieferant.com"
                className={errors.email ? "border-danger" : ""}
              />
            </Field>
            <Field label="Telefon">
              <TextInput
                type="tel"
                value={draft.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder="+49 …"
              />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
            Konditionen
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Standardwährung" required>
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
            <Field label="Standard-Incoterm" required>
              <Select
                value={draft.incoterm}
                onChange={(e) => patch({ incoterm: e.target.value })}
              >
                {INCOTERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Zahlungsziel" required>
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
                  <option value="Tage">Tage</option>
                  <option value="Wochen">Wochen</option>
                </Select>
              </div>
            </Field>
            <Field
              label="Skonto"
              hint="Optional, z. B. 2% bei Zahlung innerhalb von 10 Tagen"
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <TextInput
                    type="number"
                    step="0.1"
                    min="0"
                    value={draft.skontoPercent || ""}
                    onChange={(e) =>
                      patch({ skontoPercent: Number(e.target.value) || 0 })
                    }
                    placeholder="%"
                  />
                </div>
                <TextInput
                  type="number"
                  min="0"
                  value={draft.skontoDays || ""}
                  onChange={(e) =>
                    patch({ skontoDays: Number(e.target.value) || 0 })
                  }
                  placeholder="Tage"
                  className="w-[110px]"
                />
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
            Weitere Angaben (optional)
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
              <Field label="USt-IdNr. / Steuernummer">
                <TextInput
                  value={draft.taxId}
                  onChange={(e) => patch({ taxId: e.target.value })}
                />
              </Field>
              <Field label="Rechtsform">
                <Select
                  value={draft.legalForm}
                  onChange={(e) => patch({ legalForm: e.target.value })}
                >
                  {LEGAL_FORMS.map((f) => (
                    <option key={f || "none"} value={f}>
                      {f || "—"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Website">
                <TextInput
                  value={draft.website}
                  onChange={(e) => patch({ website: e.target.value })}
                  placeholder="https://"
                />
              </Field>
              <Field label="Herkunftshafen / -flughafen">
                <TextInput
                  value={draft.originPort}
                  onChange={(e) => patch({ originPort: e.target.value })}
                  placeholder="z. B. Yantian"
                />
              </Field>
              <Field label="Übliche Lieferzeit (Tage)">
                <TextInput
                  type="number"
                  min="0"
                  value={draft.leadTimeDays || ""}
                  onChange={(e) =>
                    patch({ leadTimeDays: Number(e.target.value) || 0 })
                  }
                />
              </Field>
              <Field label="Bankverbindung (IBAN)">
                <TextInput
                  value={draft.iban}
                  onChange={(e) => patch({ iban: e.target.value })}
                />
              </Field>
              <Field label="Zertifizierungen">
                <TextInput
                  value={draft.certifications}
                  onChange={(e) => patch({ certifications: e.target.value })}
                  placeholder="ISO 9001, BSCI, …"
                />
              </Field>
              <Field label="Status">
                <Select
                  value={draft.status}
                  onChange={(e) =>
                    patch({ status: e.target.value as SupplierStatus })
                  }
                >
                  {(Object.keys(SUPPLIER_STATUS_LABELS) as SupplierStatus[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {SUPPLIER_STATUS_LABELS[key]}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Interne Notizen">
                  <TextArea
                    value={draft.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    placeholder="Interne Hinweise zum Lieferanten…"
                  />
                </Field>
              </div>
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[12px] text-muted-soft">* Pflichtfelder</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit">
              {isEdit ? "Änderungen speichern" : "Lieferant speichern"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

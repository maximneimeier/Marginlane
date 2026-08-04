"use client";

import { useEffect, useState } from "react";
import type { DiscountTier, Product, Supplier } from "@/lib/types";
import { createId } from "@/lib/format";
import {
  Button,
  Field,
  Modal,
  Select,
  TextInput,
} from "@/components/ui";

export function emptyProduct(supplierId: string): Product {
  return {
    id: createId("prd"),
    supplierId,
    name: "",
    sku: "",
    unitPrice: 0,
    moq: 0,
    discountTiers: [],
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

export function ProductFormModal({
  open,
  initial,
  suppliers,
  isEdit,
  onClose,
  onSave,
  lockSupplier = false,
}: Props) {
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

  if (!draft) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? "Produkt bearbeiten" : "Neues Produkt"}
      >
        <p className="text-[13px] text-muted">Kein Entwurf geladen.</p>
      </Modal>
    );
  }

  function updateTier(index: number, patch: Partial<DiscountTier>) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        discountTiers: prev.discountTiers.map((t, i) =>
          i === index ? { ...t, ...patch } : t,
        ),
      };
    });
  }

  function handleSave() {
    if (!draft || !draft.name.trim() || !draft.supplierId) return;
    onSave({ ...draft, name: draft.name.trim() });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Produkt bearbeiten" : "Neues Produkt"}
      description="Lieferant, Bezeichnung und Konditionen angeben."
      wide
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lieferant" required>
            <Select
              value={draft.supplierId}
              onChange={(e) =>
                setDraft({ ...draft, supplierId: e.target.value })
              }
              disabled={lockSupplier}
            >
              <option value="">Lieferant wählen…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name" required>
            <TextInput
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="z. B. Artikelbezeichnung"
            />
          </Field>
          <Field label="SKU">
            <TextInput
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
              placeholder="z. B. ART-001"
            />
          </Field>
          <Field label="Preis / Stück (€)">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={draft.unitPrice || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  unitPrice: Number(e.target.value) || 0,
                })
              }
              placeholder="0,00"
            />
          </Field>
          <Field label="Mindestabnahme (MOQ)">
            <TextInput
              type="number"
              min="0"
              value={draft.moq || ""}
              onChange={(e) =>
                setDraft({ ...draft, moq: Number(e.target.value) || 0 })
              }
              placeholder="z. B. 100"
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-medium text-muted">Rabattstaffeln</p>
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
              + Staffel
            </Button>
          </div>
          {draft.discountTiers.length === 0 ? (
            <p className="text-[13px] text-muted-soft">Keine Staffeln.</p>
          ) : (
            <ul className="space-y-2">
              {draft.discountTiers.map((tier, i) => (
                <li key={i} className="flex flex-wrap items-end gap-2">
                  <Field label="Ab Menge">
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
                  <Field label="Rabatt %">
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
            Abbrechen
          </Button>
          <Button onClick={handleSave}>Speichern</Button>
        </div>
      </div>
    </Modal>
  );
}

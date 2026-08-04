"use client";

import { useEffect, useState } from "react";
import type { Dealer, DealerChannel, DealerStatus } from "@/lib/types";
import {
  COUNTRIES,
  DEALER_CHANNEL_LABELS,
  DEALER_STATUS_LABELS,
  SALES_PHASES,
} from "@/lib/types";
import { createId, formatEuro } from "@/lib/format";
import { CostItemEditor } from "@/components/CostItemEditor";
import {
  Button,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";

export function emptyDealer(): Dealer {
  return {
    id: createId("dlr"),
    name: "",
    country: "DE",
    contactName: "",
    email: "",
    phone: "",
    channel: "b2b",
    paymentTerms: "30 Tage",
    defaultSellPrice: 0,
    salesCostItems: [],
    status: "active",
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

type Props = {
  open: boolean;
  initial: Dealer | null;
  isEdit: boolean;
  onClose: () => void;
  onSave: (dealer: Dealer) => void;
};

export function DealerFormModal({
  open,
  initial,
  isEdit,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<Dealer>(emptyDealer());

  useEffect(() => {
    if (!open) return;
    setDraft(initial ? structuredClone(initial) : emptyDealer());
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function handleSave() {
    if (!draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim() });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Händler bearbeiten" : "Neuen Händler anlegen"}
      description="Verkaufspreis und Vertriebskosten werden bei der Charge übernommen."
      wide
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <TextInput
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="z. B. MediaMarkt Saturn"
            />
          </Field>
          <Field label="Kanal" required>
            <Select
              value={draft.channel}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  channel: e.target.value as DealerChannel,
                })
              }
            >
              {(Object.keys(DEALER_CHANNEL_LABELS) as DealerChannel[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {DEALER_CHANNEL_LABELS[key]}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="Land">
            <Select
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
            >
              <option value="">Land wählen…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  status: e.target.value as DealerStatus,
                })
              }
            >
              {(Object.keys(DEALER_STATUS_LABELS) as DealerStatus[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {DEALER_STATUS_LABELS[key]}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="Ansprechpartner">
            <TextInput
              value={draft.contactName}
              onChange={(e) =>
                setDraft({ ...draft, contactName: e.target.value })
              }
            />
          </Field>
          <Field label="E-Mail">
            <TextInput
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
          <Field label="Telefon">
            <TextInput
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </Field>
          <Field label="Zahlungskonditionen">
            <TextInput
              value={draft.paymentTerms}
              onChange={(e) =>
                setDraft({ ...draft, paymentTerms: e.target.value })
              }
              placeholder="z. B. 30 Tage"
            />
          </Field>
          <Field
            label="Standard-Verkaufspreis / Stück (€)"
            hint="Wird beim Auswählen in der Charge vorausgefüllt."
          >
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={draft.defaultSellPrice || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  defaultSellPrice: Number(e.target.value) || 0,
                })
              }
              placeholder="0,00"
            />
          </Field>
          {draft.defaultSellPrice > 0 ? (
            <div className="flex items-end">
              <p className="pb-2 text-[12px] text-muted">
                Vorschau:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatEuro(draft.defaultSellPrice)}
                </span>
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-[10px] border border-line bg-surface-faint p-3.5">
          <CostItemEditor
            title="Standard-Vertriebskosten"
            items={draft.salesCostItems}
            onChange={(salesCostItems) =>
              setDraft({ ...draft, salesCostItems })
            }
            allowedPhases={SALES_PHASES}
            percentOfRevenue
          />
          <p className="mt-2 text-[12px] text-muted-soft">
            Diese Kosten werden übernommen, sobald der Händler an einer Charge
            gewählt wird.
          </p>
        </div>

        <Field label="Notizen">
          <TextArea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={3}
          />
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={!draft.name.trim()}>
            Speichern
          </Button>
        </div>
      </form>
    </Modal>
  );
}

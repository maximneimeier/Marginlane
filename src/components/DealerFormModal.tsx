"use client";

import { useEffect, useState } from "react";
import type { Dealer, DealerChannel, DealerStatus } from "@/lib/types";
import { COUNTRIES, SALES_PHASES } from "@/lib/types";
import { CURRENCIES } from "@/lib/types";
import { createId, formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
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
    currency: "EUR",
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
  const { t, locale, dealerChannelLabel, dealerStatusLabel, countryLabel } =
    useI18n();
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
      title={isEdit ? t("dealerModal.editTitle") : t("dealerModal.createTitle")}
      description={t("dealerModal.description")}
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
          <Field label={t("dealerModal.name")} required>
            <TextInput
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t("dealerModal.namePlaceholder")}
            />
          </Field>
          <Field label={t("dealerModal.channel")} required>
            <Select
              value={draft.channel}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  channel: e.target.value as DealerChannel,
                })
              }
            >
              {(
                ["b2b", "retail", "marketplace", "online", "other"] as DealerChannel[]
              ).map((key) => (
                <option key={key} value={key}>
                  {dealerChannelLabel(key)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("dealerModal.country")}>
            <Select
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
            >
              <option value="">{t("dealerModal.selectCountry")}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {countryLabel(c.code)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("dealerModal.status")}>
            <Select
              value={draft.status}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  status: e.target.value as DealerStatus,
                })
              }
            >
              {(["active", "inactive"] as DealerStatus[]).map((key) => (
                <option key={key} value={key}>
                  {dealerStatusLabel(key)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("dealerModal.contactName")}>
            <TextInput
              value={draft.contactName}
              onChange={(e) =>
                setDraft({ ...draft, contactName: e.target.value })
              }
            />
          </Field>
          <Field label={t("dealerModal.email")}>
            <TextInput
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
          <Field label={t("dealerModal.phone")}>
            <TextInput
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </Field>
          <Field label={t("dealerModal.paymentTerms")}>
            <TextInput
              value={draft.paymentTerms}
              onChange={(e) =>
                setDraft({ ...draft, paymentTerms: e.target.value })
              }
              placeholder={t("dealerModal.paymentTermsPlaceholder")}
            />
          </Field>
          <Field label={t("dealerModal.currency")}>
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
          <Field
            label={t("dealerModal.defaultSellPrice")}
            hint={t("dealerModal.defaultSellPriceHint")}
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
                {t("dealerModal.preview")}{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatEuro(draft.defaultSellPrice, locale)}
                </span>
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-[10px] border border-line bg-surface-faint p-3.5">
          <CostItemEditor
            title={t("dealerModal.defaultSalesCosts")}
            items={draft.salesCostItems}
            onChange={(salesCostItems) =>
              setDraft({ ...draft, salesCostItems })
            }
            allowedPhases={SALES_PHASES}
            percentOfRevenue
          />
          <p className="mt-2 text-[12px] text-muted-soft">
            {t("dealerModal.salesCostsHint")}
          </p>
        </div>

        <Field label={t("dealerModal.notes")}>
          <TextArea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={3}
          />
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!draft.name.trim()}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

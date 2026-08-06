"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  OverheadAllocation,
  OverheadItem,
  Product,
} from "@/lib/types";
import {
  CURRENCIES,
  OVERHEAD_ALLOCATIONS,
  OVERHEAD_CATEGORIES,
  OVERHEAD_PERIODS,
} from "@/lib/types";
import {
  emptyOverheadItem,
  isManualAllocationValid,
  sumManualPercents,
} from "@/lib/overhead";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import {
  Button,
  Field,
  Modal,
  Select,
  TextInput,
} from "@/components/ui";

type Props = {
  open: boolean;
  initial: OverheadItem | null;
  products: Product[];
  isEdit: boolean;
  defaultCurrency?: string;
  onClose: () => void;
  onSave: (item: OverheadItem) => void;
};

export function OverheadFormModal({
  open,
  initial,
  products,
  isEdit,
  defaultCurrency = "EUR",
  onClose,
  onSave,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<OverheadItem | null>(null);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setDraft(structuredClone(initial));
      return;
    }
    setDraft(emptyOverheadItem(defaultCurrency));
  }, [open, initial, defaultCurrency]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const title = isEdit
    ? t("overhead.modal.editTitle")
    : t("overhead.modal.createTitle");

  if (!draft) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        <p className="text-[13px] text-muted">{t("common.loading")}</p>
      </Modal>
    );
  }

  const manualSum = sumManualPercents(draft.manuelleAufteilung);
  const manualOk =
    draft.verteilschluessel !== "manuell" ||
    isManualAllocationValid(draft.manuelleAufteilung);
  const canSave =
    Boolean(draft.name.trim()) &&
    Number.isFinite(draft.betrag) &&
    draft.betrag > 0 &&
    manualOk;

  function setAllocation(next: OverheadAllocation) {
    setDraft((prev) => {
      if (!prev) return prev;
      if (next === "manuell") {
        const existing = new Map(
          (prev.manuelleAufteilung ?? []).map((row) => [
            row.productId,
            row.percent,
          ]),
        );
        const equal =
          sortedProducts.length > 0 ? 100 / sortedProducts.length : 0;
        return {
          ...prev,
          verteilschluessel: next,
          manuelleAufteilung: sortedProducts.map((p) => ({
            productId: p.id,
            percent: existing.get(p.id) ?? equal,
          })),
        };
      }
      return {
        ...prev,
        verteilschluessel: next,
        manuelleAufteilung: null,
      };
    });
  }

  function updateManualPercent(productId: string, percent: number) {
    setDraft((prev) => {
      if (!prev?.manuelleAufteilung) return prev;
      return {
        ...prev,
        manuelleAufteilung: prev.manuelleAufteilung.map((row) =>
          row.productId === productId ? { ...row, percent } : row,
        ),
      };
    });
  }

  function handleSave() {
    if (!draft || !canSave) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      manuelleAufteilung:
        draft.verteilschluessel === "manuell"
          ? draft.manuelleAufteilung
          : null,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={t("overhead.modal.description")}
      wide
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("overhead.field.name")} required>
            <TextInput
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t("overhead.field.namePlaceholder")}
              autoFocus
            />
          </Field>
          <Field label={t("overhead.field.betrag")} required>
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={draft.betrag || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  betrag: e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label={t("overhead.field.waehrung")} required>
            <Select
              value={draft.waehrung}
              onChange={(e) =>
                setDraft({ ...draft, waehrung: e.target.value })
              }
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("overhead.field.periode")} required>
            <Select
              value={draft.periode}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  periode: e.target.value as OverheadItem["periode"],
                })
              }
            >
              {OVERHEAD_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`overhead.period.${p}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("overhead.field.kategorie")} required>
            <Select
              value={draft.kategorie}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  kategorie: e.target.value as OverheadItem["kategorie"],
                })
              }
            >
              {OVERHEAD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`overhead.category.${c}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={t("overhead.field.verteilschluessel")} required>
          <div className="grid gap-2 sm:grid-cols-2">
            {OVERHEAD_ALLOCATIONS.map((key) => {
              const active = draft.verteilschluessel === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAllocation(key)}
                  className={`rounded-[10px] border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-white hover:border-line-strong hover:bg-surface-faint"
                  }`}
                >
                  <span
                    className={`block text-[13px] font-medium ${
                      active ? "text-accent" : "text-foreground"
                    }`}
                  >
                    {t(`overhead.allocation.${key}` as MessageKey)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {t(`overhead.allocationHint.${key}` as MessageKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        {draft.verteilschluessel === "manuell" ? (
          <div className="rounded-[12px] border border-line bg-surface-faint p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-medium text-foreground">
                {t("overhead.manual.title")}
              </p>
              <p
                className={`text-[12px] tabular-nums ${
                  manualOk ? "text-success" : "text-danger"
                }`}
              >
                {t("overhead.manual.sum", {
                  sum: manualSum.toFixed(1),
                })}
              </p>
            </div>
            {sortedProducts.length === 0 ? (
              <p className="text-[13px] text-muted">
                {t("overhead.manual.noProducts")}
              </p>
            ) : (
              <ul className="max-h-[240px] space-y-2 overflow-y-auto">
                {sortedProducts.map((product) => {
                  const row = draft.manuelleAufteilung?.find(
                    (r) => r.productId === product.id,
                  );
                  return (
                    <li
                      key={product.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0 truncate text-[13px] text-foreground">
                        {product.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <TextInput
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={row?.percent ?? 0}
                          onChange={(e) =>
                            updateManualPercent(
                              product.id,
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                            )
                          }
                          className="!w-[88px] text-right"
                        />
                        <span className="text-[12px] text-muted">%</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {!manualOk ? (
              <p className="mt-2 text-[12px] text-danger">
                {t("overhead.manual.must100")}
              </p>
            ) : null}
          </div>
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

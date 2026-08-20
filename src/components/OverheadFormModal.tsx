"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  OverheadAllocation,
  OverheadCostBehavior,
  OverheadItem,
  OverheadVariableBasis,
  CatalogProduct,
} from "@/lib/types";
import {
  CURRENCIES,
  OVERHEAD_ALLOCATIONS,
  OVERHEAD_CATEGORIES,
  OVERHEAD_COST_BEHAVIORS,
  OVERHEAD_PERIODS,
  OVERHEAD_VARIABLE_BASES,
} from "@/lib/types";
import {
  emptyOverheadItem,
  isManualAllocationValid,
  sumManualPercents,
} from "@/lib/overhead";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import { usePrefs } from "@/context/PreferencesContext";
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
  products: CatalogProduct[];
  isEdit: boolean;
  defaultCurrency?: string;
  /** Kategorie fest vorgeben (z. B. Lagerung) */
  lockedCategory?: OverheadItem["kategorie"];
  /** Default-Verteilschlüssel bei Neuanlage */
  defaultAllocation?: OverheadItem["verteilschluessel"];
  onClose: () => void;
  onSave: (item: OverheadItem) => void;
};

export function OverheadFormModal({
  open,
  initial,
  products,
  isEdit,
  defaultCurrency = "EUR",
  lockedCategory,
  defaultAllocation,
  onClose,
  onSave,
}: Props) {
  const { t } = useI18n();
  const { prefs } = usePrefs();
  const [draft, setDraft] = useState<OverheadItem | null>(null);
  /** Anzeige-Strings für %-Felder — leer erlaubt, gilt als 0 */
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>(
    {},
  );

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const cloned = structuredClone(initial);
      if (lockedCategory) cloned.kategorie = lockedCategory;
      setDraft(cloned);
      const inputs: Record<string, string> = {};
      for (const row of initial.manuelleAufteilung ?? []) {
        inputs[row.productId] = String(row.percent);
      }
      setPercentInputs(inputs);
      return;
    }
    setDraft(
      emptyOverheadItem(defaultCurrency, {
        kategorie: lockedCategory,
        verteilschluessel: defaultAllocation,
      }),
    );
    setPercentInputs({});
  }, [open, initial, defaultCurrency, lockedCategory, defaultAllocation]);

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
  const kostenart = draft.kostenart ?? "fix";
  const needsVariable =
    kostenart === "variabel" || kostenart === "semi_variabel";
  const fixedOk =
    kostenart === "variabel"
      ? Number.isFinite(draft.betrag) && draft.betrag >= 0
      : Number.isFinite(draft.betrag) && draft.betrag > 0;
  const variableOk =
    !needsVariable ||
    (Boolean(draft.variableBasis) &&
      draft.variableRate != null &&
      Number.isFinite(draft.variableRate) &&
      draft.variableRate > 0);
  const canSave =
    Boolean(draft.name.trim()) && fixedOk && variableOk && manualOk;

  function setKostenart(next: OverheadCostBehavior) {
    if (!draft) return;
    if (next === "fix") {
      setDraft({
        ...draft,
        kostenart: next,
        variableBasis: null,
        variableRate: null,
      });
      return;
    }
    setDraft({
      ...draft,
      kostenart: next,
      variableBasis: draft.variableBasis ?? "stueck",
      variableRate:
        draft.variableRate != null && Number.isFinite(draft.variableRate)
          ? draft.variableRate
          : null,
    });
  }

  function setAllocation(next: OverheadAllocation) {
    if (!draft) return;
    if (next === "manuell") {
      const existing = new Map(
        (draft.manuelleAufteilung ?? []).map((row) => [
          row.productId,
          row.percent,
        ]),
      );
      const equal =
        sortedProducts.length > 0 ? 100 / sortedProducts.length : 0;
      const rows = sortedProducts.map((p) => ({
        productId: p.id,
        percent: existing.get(p.id) ?? equal,
      }));
      const inputs: Record<string, string> = {};
      for (const row of rows) {
        inputs[row.productId] = String(row.percent);
      }
      setPercentInputs(inputs);
      setDraft({
        ...draft,
        verteilschluessel: next,
        manuelleAufteilung: rows,
      });
      return;
    }
    setPercentInputs({});
    setDraft({
      ...draft,
      verteilschluessel: next,
      manuelleAufteilung: null,
    });
  }

  function updateManualPercentInput(productId: string, raw: string) {
    setPercentInputs((prev) => ({ ...prev, [productId]: raw }));
    const percent =
      raw.trim() === "" ? 0 : Math.max(0, Number(raw) || 0);
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
    const von = draft.gueltigVon || null;
    const bis = draft.gueltigBis || null;
    // Wenn beide gesetzt und von > bis: tauschen
    const gueltigVon =
      von && bis && von > bis ? bis : von;
    const gueltigBis =
      von && bis && von > bis ? von : bis;
    const nextKostenart = draft.kostenart ?? "fix";
    const isVariable =
      nextKostenart === "variabel" || nextKostenart === "semi_variabel";
    onSave({
      ...draft,
      name: draft.name.trim(),
      kostenart: nextKostenart,
      betrag: nextKostenart === "variabel" ? 0 : draft.betrag,
      variableBasis: isVariable ? draft.variableBasis : null,
      variableRate: isVariable ? draft.variableRate : null,
      gueltigVon,
      gueltigBis,
      updatedBy: prefs.displayName?.trim() || null,
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
          {kostenart !== "variabel" ? (
            <Field
              label={
                kostenart === "semi_variabel"
                  ? t("overhead.field.betragFix")
                  : t("overhead.field.betrag")
              }
              hint={
                kostenart === "semi_variabel"
                  ? t("overhead.field.betragFixHint")
                  : undefined
              }
              required
            >
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
          ) : null}
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
          <Field
            label={t("overhead.field.kategorie")}
            hint={t(
              `overhead.categoryHint.${draft.kategorie}` as MessageKey,
            )}
            required
          >
            {lockedCategory ? (
              <div className="flex h-[34px] items-center rounded-[8px] border border-line bg-surface-faint px-3 text-[13px] text-foreground">
                {t(`overhead.category.${lockedCategory}` as MessageKey)}
              </div>
            ) : (
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
            )}
          </Field>
          <Field
            label={t("overhead.field.kostenart")}
            hint={t(
              `overhead.costBehaviorHint.${kostenart}` as MessageKey,
            )}
            required
          >
            <Select
              value={kostenart}
              onChange={(e) =>
                setKostenart(e.target.value as OverheadCostBehavior)
              }
            >
              {OVERHEAD_COST_BEHAVIORS.map((c) => (
                <option key={c} value={c}>
                  {t(`overhead.costBehavior.${c}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
          {needsVariable ? (
            <>
              <Field
                label={t("overhead.field.variableBasis")}
                hint={t("overhead.field.variableBasisHint")}
                required
              >
                <Select
                  value={draft.variableBasis ?? "stueck"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      variableBasis: e.target.value as OverheadVariableBasis,
                    })
                  }
                >
                  {OVERHEAD_VARIABLE_BASES.map((b) => (
                    <option key={b} value={b}>
                      {t(`overhead.variableBasis.${b}` as MessageKey)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={
                  draft.variableBasis === "umsatz"
                    ? t("overhead.field.variableRatePercent")
                    : t("overhead.field.variableRatePerUnit")
                }
                hint={
                  draft.variableBasis === "umsatz"
                    ? t("overhead.field.variableRatePercentHint")
                    : t("overhead.field.variableRatePerUnitHint")
                }
                required
              >
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.variableRate ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      variableRate:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
            </>
          ) : null}
          <Field
            label={t("overhead.field.gueltigVon")}
            hint={t("overhead.field.gueltigHint")}
          >
            <TextInput
              type="date"
              value={draft.gueltigVon ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  gueltigVon: e.target.value === "" ? null : e.target.value,
                })
              }
            />
          </Field>
          <Field
            label={t("overhead.field.gueltigBis")}
            hint={t("overhead.field.gueltigHint")}
          >
            <TextInput
              type="date"
              value={draft.gueltigBis ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  gueltigBis: e.target.value === "" ? null : e.target.value,
                })
              }
            />
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
                          value={
                            percentInputs[product.id] ??
                            (row ? String(row.percent) : "")
                          }
                          onChange={(e) =>
                            updateManualPercentInput(
                              product.id,
                              e.target.value,
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

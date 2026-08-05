"use client";

import type {
  CommercialOverrides,
  PaymentUnit,
} from "@/lib/types";
import { CURRENCIES, INCOTERMS } from "@/lib/types";
import type { ResolvedCommercial } from "@/lib/resolve";
import { emptyCommercialOverrides } from "@/lib/resolve";
import { useI18n } from "@/hooks/useI18n";
import { Button, Field, Select, TextInput } from "@/components/ui";

type Props = {
  value: CommercialOverrides;
  /** Werte der Parent-Ebene (ohne aktuelle Overrides) — für „Erben …“ */
  inherited: ResolvedCommercial;
  /** Wirksame Werte inkl. aktueller Overrides */
  resolved: ResolvedCommercial;
  /** Anzeigename der Parent-Ebene (Lieferant bzw. Lieferant/Produkt) */
  parentLabel: string;
  onChange: (next: CommercialOverrides) => void;
};

function hasAnyOverride(value: CommercialOverrides): boolean {
  return (
    value.currency !== null ||
    value.paymentDays !== null ||
    value.paymentUnit !== null ||
    value.skontoPercent !== null ||
    value.skontoDays !== null ||
    value.incoterm !== null
  );
}

export function CommercialOverridesEditor({
  value,
  inherited,
  resolved,
  parentLabel,
  onChange,
}: Props) {
  const { t } = useI18n();

  function patch(partial: Partial<CommercialOverrides>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="rounded-[12px] border border-line bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            {t("commercial.title")}
          </h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {t("commercial.hint", { parent: parentLabel })}
          </p>
        </div>
        {hasAnyOverride(value) ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(emptyCommercialOverrides())}
          >
            {t("commercial.resetAll")}
          </Button>
        ) : (
          <span className="rounded-[6px] bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
            {t("commercial.allInherited")}
          </span>
        )}
      </div>

      <p className="mb-3 rounded-[8px] border border-line bg-surface-faint px-3 py-2 text-[12px] text-muted">
        <span className="font-medium text-foreground">
          {t("commercial.effective")}:
        </span>{" "}
        {resolved.paymentTerms}
        {resolved.incoterm ? ` · ${resolved.incoterm}` : ""}
        {resolved.currency ? ` · ${resolved.currency}` : ""}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t("commercial.currency")}
          hint={
            value.currency === null
              ? t("commercial.inheritsValue", {
                  value: inherited.currency,
                  parent: parentLabel,
                })
              : t("commercial.overridden")
          }
        >
          <Select
            value={value.currency ?? ""}
            onChange={(e) =>
              patch({
                currency: e.target.value === "" ? null : e.target.value,
              })
            }
          >
            <option value="">
              {t("commercial.inheritOption", { value: inherited.currency })}
            </option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t("commercial.incoterm")}
          hint={
            value.incoterm === null
              ? t("commercial.inheritsValue", {
                  value: inherited.incoterm,
                  parent: parentLabel,
                })
              : t("commercial.overridden")
          }
        >
          <Select
            value={value.incoterm ?? ""}
            onChange={(e) =>
              patch({
                incoterm: e.target.value === "" ? null : e.target.value,
              })
            }
          >
            <option value="">
              {t("commercial.inheritOption", { value: inherited.incoterm })}
            </option>
            {INCOTERMS.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t("commercial.paymentDays")}
          hint={
            value.paymentDays === null && value.paymentUnit === null
              ? t("commercial.inheritsValue", {
                  value: `${inherited.paymentDays} ${inherited.paymentUnit}`,
                  parent: parentLabel,
                })
              : t("commercial.overridden")
          }
        >
          <div className="flex gap-2">
            <TextInput
              type="number"
              min="1"
              placeholder={String(inherited.paymentDays)}
              value={value.paymentDays ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  patch({ paymentDays: null, paymentUnit: null });
                  return;
                }
                patch({
                  paymentDays: Number(raw) || 0,
                  paymentUnit: value.paymentUnit ?? inherited.paymentUnit,
                });
              }}
              className="min-w-0 flex-[2.5]"
            />
            <Select
              value={value.paymentUnit ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  patch({ paymentUnit: null });
                  return;
                }
                patch({
                  paymentUnit: raw as PaymentUnit,
                  paymentDays: value.paymentDays ?? inherited.paymentDays,
                });
              }}
              className="w-[110px] shrink-0"
            >
              <option value="">{t("commercial.inheritShort")}</option>
              <option value="Tage">{t("paymentUnit.Tage")}</option>
              <option value="Wochen">{t("paymentUnit.Wochen")}</option>
            </Select>
          </div>
        </Field>

        <Field
          label={t("commercial.skonto")}
          hint={
            value.skontoPercent === null && value.skontoDays === null
              ? t("commercial.inheritsValue", {
                  value:
                    inherited.skontoPercent > 0
                      ? `${inherited.skontoPercent}% / ${inherited.skontoDays}d`
                      : t("commercial.noSkonto"),
                  parent: parentLabel,
                })
              : t("commercial.overridden")
          }
        >
          <div className="flex gap-2">
            <TextInput
              type="number"
              step="0.1"
              min="0"
              placeholder={String(inherited.skontoPercent)}
              value={value.skontoPercent ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  patch({ skontoPercent: null, skontoDays: null });
                  return;
                }
                patch({
                  skontoPercent: Number(raw) || 0,
                  skontoDays: value.skontoDays ?? inherited.skontoDays,
                });
              }}
              className="flex-1"
            />
            <TextInput
              type="number"
              min="0"
              placeholder={String(inherited.skontoDays)}
              value={value.skontoDays ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  patch({ skontoDays: null });
                  return;
                }
                patch({
                  skontoDays: Number(raw) || 0,
                  skontoPercent:
                    value.skontoPercent ?? inherited.skontoPercent,
                });
              }}
              className="w-[110px]"
            />
          </div>
        </Field>
      </div>
    </div>
  );
}

/** Extrahiert nur die Override-Felder aus Product/Batch */
export function pickCommercialOverrides(
  entity: CommercialOverrides,
): CommercialOverrides {
  return {
    currency: entity.currency,
    paymentDays: entity.paymentDays,
    paymentUnit: entity.paymentUnit,
    skontoPercent: entity.skontoPercent,
    skontoDays: entity.skontoDays,
    incoterm: entity.incoterm,
  };
}

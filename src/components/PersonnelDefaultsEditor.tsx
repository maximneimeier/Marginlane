"use client";

import type {
  CompanySettings,
  NumberFormatStyle,
  PersonnelDefaultKind,
  PersonnelDefaultLine,
  PersonnelDefaultUnit,
} from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
import {
  derivePersonnelAggregatesFromLines,
  emptyPersonnelDefaultLine,
  sumBenefitMonthly,
  sumBenefitPercent,
  sumMandatoryPercent,
} from "@/lib/companySettings";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { Button, Select, TextInput } from "@/components/ui";

type NumberInputCtxValue = {
  numberFormat: NumberFormatStyle;
  locale: string;
};

/** Gleiches Number-Field-Pattern wie auf der Firmenseite */
function InlineNum({
  value,
  onValueChange,
  numberFormat,
  locale,
}: {
  value: number;
  onValueChange: (next: number) => void;
  numberFormat: NumberFormatStyle;
  locale: string;
}) {
  const display = value === 0 ? "" : formatNumber(value, locale);
  return (
    <TextInput
      inputMode="decimal"
      className="h-8 min-w-[5.5rem] text-right tabular-nums"
      defaultValue={display}
      key={`${value}-${locale}`}
      onBlur={(e) => {
        const raw = e.target.value.trim().replace(/\s/g, "");
        if (!raw) {
          onValueChange(0);
          return;
        }
        const normalized =
          numberFormat === "de"
            ? raw.replace(/\./g, "").replace(",", ".")
            : raw.replace(/,/g, "");
        const n = Number(normalized);
        onValueChange(Number.isFinite(n) ? Math.max(0, n) : 0);
      }}
    />
  );
}

function PersonnelDefaultsTable({
  kind,
  lines,
  onChange,
  locale,
  numberFormat,
  t,
}: {
  kind: PersonnelDefaultKind;
  lines: PersonnelDefaultLine[];
  onChange: (next: PersonnelDefaultLine[]) => void;
  locale: string;
  numberFormat: NumberFormatStyle;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const rows = lines.filter((l) => l.kind === kind);
  const allowUnit = kind === "benefit";

  const patchRow = (id: string, partial: Partial<PersonnelDefaultLine>) => {
    onChange(
      lines.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...partial };
        if (next.kind === "mandatory") next.unit = "percent";
        return next;
      }),
    );
  };

  const removeRow = (id: string) => {
    onChange(lines.filter((line) => line.id !== id));
  };

  const addRow = () => {
    onChange([...lines, emptyPersonnelDefaultLine(kind)]);
  };

  const percentTotal =
    kind === "mandatory"
      ? sumMandatoryPercent(rows)
      : sumBenefitPercent(rows);
  const monthlyTotal = kind === "benefit" ? sumBenefitMonthly(rows) : 0;

  return (
    <div className="rounded-[10px] border border-line p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-foreground">
            {kind === "mandatory"
              ? t("company.personnel.mandatoryTitle")
              : t("company.personnel.benefitsTitle")}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {kind === "mandatory"
              ? t("company.personnel.mandatoryHint")
              : t("company.personnel.benefitsHint")}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={addRow}>
          {kind === "mandatory"
            ? t("company.personnel.addMandatory")
            : t("company.personnel.addBenefit")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-line px-3 py-5 text-center text-[13px] text-muted">
          {kind === "mandatory"
            ? t("company.personnel.mandatoryEmpty")
            : t("company.personnel.benefitsEmpty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-line">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                <th className="px-3 py-2 font-medium">
                  {t("company.personnel.col.name")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("company.personnel.col.unit")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("company.personnel.col.value")}
                </th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-2 py-1.5">
                    <TextInput
                      value={row.name}
                      onChange={(e) =>
                        patchRow(row.id, { name: e.target.value })
                      }
                      placeholder={
                        kind === "mandatory"
                          ? t("company.personnel.namePlaceholderMandatory")
                          : t("company.personnel.namePlaceholderBenefit")
                      }
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    {allowUnit ? (
                      <Select
                        value={row.unit}
                        onChange={(e) =>
                          patchRow(row.id, {
                            unit: e.target.value as PersonnelDefaultUnit,
                          })
                        }
                        className="h-8"
                      >
                        <option value="percent">
                          {t("company.personnel.unit.percent")}
                        </option>
                        <option value="annual">
                          {t("company.personnel.unit.annual")}
                        </option>
                        <option value="monthly">
                          {t("company.personnel.unit.monthly")}
                        </option>
                      </Select>
                    ) : (
                      <span className="px-1 text-muted">
                        {t("company.personnel.unit.percent")}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <InlineNum
                      value={row.value}
                      numberFormat={numberFormat}
                      locale={locale}
                      onValueChange={(n) => patchRow(row.id, { value: n })}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded-[6px] px-2 py-1 text-[12px] text-muted hover:bg-surface-soft hover:text-danger"
                      aria-label={t("common.delete")}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-[8px] bg-surface-soft px-3 py-2 text-[13px]">
          <span className="font-medium text-foreground">
            {kind === "mandatory"
              ? t("company.personnel.mandatoryTotal")
              : t("company.personnel.benefitsPercentTotal")}
          </span>
          <span className="font-semibold tabular-nums">
            {new Intl.NumberFormat(locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(percentTotal)}{" "}
            %
          </span>
        </div>
        {kind === "benefit" ? (
          <div className="flex items-center justify-between rounded-[8px] bg-surface-soft px-3 py-2 text-[13px]">
            <span className="font-medium text-foreground">
              {t("company.personnel.benefitsMonthlyTotal")}
            </span>
            <span className="font-semibold tabular-nums">
              {new Intl.NumberFormat(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(monthlyTotal)}{" "}
              / {t("company.personnel.perMonth")}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PersonnelDefaultsEditor({
  settings,
  onPatch,
  numberFormat,
  locale,
}: {
  settings: CompanySettings;
  onPatch: (partial: Partial<CompanySettings>) => void;
  numberFormat: NumberFormatStyle;
  locale: string;
}) {
  const { t } = useI18n();
  const lines = settings.personnelDefaultLines ?? [];

  const setLines = (next: PersonnelDefaultLine[]) => {
    onPatch({
      personnelDefaultLines: next,
      ...derivePersonnelAggregatesFromLines(next),
    });
  };

  return (
    <div className="space-y-5">
      <PersonnelDefaultsTable
        kind="mandatory"
        lines={lines}
        onChange={setLines}
        locale={locale}
        numberFormat={numberFormat}
        t={t}
      />
      <PersonnelDefaultsTable
        kind="benefit"
        lines={lines}
        onChange={setLines}
        locale={locale}
        numberFormat={numberFormat}
        t={t}
      />
    </div>
  );
}

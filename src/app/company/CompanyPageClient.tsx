"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStore } from "@/context/StoreContext";
import { useI18n } from "@/hooks/useI18n";
import {
  CURRENCIES,
  EMPTY_COMPANY_SETTINGS,
  SIMPLE_TAX_REGIMES,
  SELECTABLE_TAX_REGIMES,
  VAT_FILING_CADENCES,
  type CompanySettings,
  type NumberFormatStyle,
  type TaxRegime,
  type VatFilingCadence,
  type VatRate,
} from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
import {
  emptyVatRate,
  isAllowedNumberDraft,
  normalizeCompanySettings,
  parseLocalizedNumber,
  combinedIncomeTaxPercent,
  resolveVatRatePercent,
  derivePersonnelAggregates,
  sumDefaultBenefitsAnnual,
  sumDefaultBenefitsPercent,
  sumDefaultEmployerPayrollTaxes,
} from "@/lib/companySettings";
import {
  computeGermanTaxBreakdown,
  computeSwissTax,
  computeUsTaxBreakdown,
  getUsStateTaxRate,
  isUsStateWithoutClassicCit,
  listUsStateTaxRates,
  usStateTaxRatesAsOfYear,
  US_FEDERAL_CORPORATE_TAX_PERCENT_DEFAULT,
} from "@/lib/taxModels";
import { formatNumber } from "@/lib/format";
import { Button, Card, ConfirmDialog, Field, PageHeader, Select, TextInput } from "@/components/ui";

function formatTaxRate(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type CompanyTab =
  | "general"
  | "starting"
  | "taxes"
  | "vat"
  | "personnel"
  | "valuation";

const COMPANY_TABS: { id: CompanyTab; labelKey: MessageKey }[] = [
  { id: "general", labelKey: "company.section.general" },
  { id: "starting", labelKey: "company.section.starting" },
  { id: "taxes", labelKey: "company.section.taxes" },
  { id: "vat", labelKey: "company.section.vat" },
  { id: "personnel", labelKey: "company.section.personnel" },
  { id: "valuation", labelKey: "company.section.valuation" },
];

const NumberInputCtx = createContext<{
  numberFormat: NumberFormatStyle;
  locale: string;
}>({ numberFormat: "de", locale: "de-DE" });

function formatCommittedNumber(
  value: number | null,
  locale: string,
): string {
  if (value === null || value === undefined) return "";
  return formatNumber(value, locale);
}

function displayUnfocusedNumber(
  value: number | null,
  locale: string,
  emptyAs: 0 | null,
): string {
  if (value === null || value === undefined) return "";
  if (emptyAs === 0 && value === 0) return "";
  return formatNumber(value, locale);
}

/** Zahlfeld: leer erlaubt; leer wird als 0 (bzw. null) gespeichert. */
function NumberField({
  value,
  onValueChange,
  emptyAs = 0,
  placeholder,
  className,
  numberFormat,
  locale,
}: {
  value: number | null;
  onValueChange: (next: number | null) => void;
  emptyAs?: 0 | null;
  placeholder?: string;
  className?: string;
  numberFormat: NumberFormatStyle;
  locale: string;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() =>
    displayUnfocusedNumber(value, locale, emptyAs),
  );

  useEffect(() => {
    if (!focused) {
      setDraft(displayUnfocusedNumber(value, locale, emptyAs));
    }
  }, [value, focused, locale, emptyAs]);

  return (
    <TextInput
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={focused ? draft : displayUnfocusedNumber(value, locale, emptyAs)}
      onFocus={(e) => {
        setFocused(true);
        const start =
          value === null ||
          value === undefined ||
          (emptyAs === 0 && value === 0)
            ? ""
            : formatCommittedNumber(value, locale);
        setDraft(start);
        requestAnimationFrame(() => {
          e.target.select();
        });
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (!isAllowedNumberDraft(raw, numberFormat)) return;
        setDraft(raw);
        if (raw.trim() === "") {
          onValueChange(emptyAs);
          return;
        }
        const parsed = parseLocalizedNumber(raw, numberFormat);
        if (parsed !== null) onValueChange(parsed);
      }}
      onBlur={() => {
        setFocused(false);
        if (draft.trim() === "") {
          onValueChange(emptyAs);
          setDraft(displayUnfocusedNumber(emptyAs, locale, emptyAs));
          return;
        }
        const parsed = parseLocalizedNumber(draft, numberFormat);
        if (parsed === null) {
          onValueChange(emptyAs);
          setDraft(displayUnfocusedNumber(emptyAs, locale, emptyAs));
          return;
        }
        onValueChange(parsed);
        setDraft(displayUnfocusedNumber(parsed, locale, emptyAs));
      }}
    />
  );
}

/** Stabile Wrapper-Komponente (nicht im Render erzeugen — sonst Remount bei jedem Tastendruck). */
function NumField(props: {
  value: number | null;
  onValueChange: (next: number | null) => void;
  emptyAs?: 0 | null;
  placeholder?: string;
  className?: string;
}) {
  const { numberFormat, locale } = useContext(NumberInputCtx);
  return (
    <NumberField {...props} numberFormat={numberFormat} locale={locale} />
  );
}

function SwissTaxSection({
  settings,
  patch,
  locale,
  t,
}: {
  settings: CompanySettings;
  patch: (partial: Partial<CompanySettings>) => void;
  locale: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const taxYear =
    (settings.modelStartMonth || settings.lastActualMonth || "").slice(0, 4) ||
    String(new Date().getFullYear());
  const swiss = computeSwissTax(settings);

  return (
    <div className="space-y-5">
      <div className="rounded-[8px] border border-line bg-surface-soft px-3 py-2">
        <p className="text-[13px] font-medium text-foreground">
          {t("company.ch.taxYear", { year: taxYear })}
        </p>
        <p className="mt-0.5 text-[12px] text-muted">
          {t("company.ch.taxYearHint")}
        </p>
      </div>

      <Field
        label={t("company.field.chFederal")}
        hint={t("company.field.chFederalHint")}
      >
        <NumField
          value={settings.chFederalTaxPercent}
          onValueChange={(n) => patch({ chFederalTaxPercent: n ?? 0 })}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t("company.field.chCantonalBase")}
          hint={t("company.field.chCantonalBaseHint")}
        >
          <NumField
            value={settings.chCantonalTaxPercent}
            onValueChange={(n) => patch({ chCantonalTaxPercent: n ?? 0 })}
          />
        </Field>
        <Field
          label={t("company.field.chCantonalFoot")}
          hint={t("company.field.chCantonalFootHint")}
        >
          <NumField
            value={settings.chCantonalTaxFoot}
            onValueChange={(n) => patch({ chCantonalTaxFoot: n ?? 0 })}
          />
        </Field>
      </div>

      <Field
        label={t("company.field.chMunicipalFoot")}
        hint={t("company.field.chMunicipalFootHint")}
      >
        <NumField
          value={settings.chMunicipalTaxFoot}
          onValueChange={(n) => patch({ chMunicipalTaxFoot: n ?? 0 })}
        />
      </Field>

      <div className="rounded-[10px] border border-line p-3">
        <p className="mb-3 text-[13px] font-medium text-foreground">
          {t("company.ch.breakdownTitle")}
        </p>
        <div className="space-y-2.5 text-[13px]">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted">{t("company.ch.line.federal")}</span>
            <span className="font-medium tabular-nums">
              {formatTaxRate(swiss.federalPercent, locale)} %
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-muted">{t("company.ch.line.cantonal")}</p>
              <p className="text-[12px] text-muted">
                {t("company.ch.formula.multiply", {
                  base: formatTaxRate(swiss.cantonalBasePercent, locale),
                  foot: formatTaxRate(swiss.cantonalTaxFootPercent, locale),
                })}
              </p>
            </div>
            <span className="font-medium tabular-nums">
              {formatTaxRate(swiss.cantonalEffectivePercent, locale)} %
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-muted">{t("company.ch.line.municipal")}</p>
              <p className="text-[12px] text-muted">
                {t("company.ch.formula.multiply", {
                  base: formatTaxRate(swiss.cantonalBasePercent, locale),
                  foot: formatTaxRate(swiss.municipalTaxFootPercent, locale),
                })}
              </p>
            </div>
            <span className="font-medium tabular-nums">
              {formatTaxRate(swiss.municipalEffectivePercent, locale)} %
            </span>
          </div>
          <div className="border-t border-line pt-2.5">
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium text-foreground">
                {t("company.ch.nominalTotal")}
              </span>
              <span className="font-semibold tabular-nums">
                {formatTaxRate(swiss.nominalCombinedPercent, locale)} %
              </span>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-muted">{t("company.ch.effectiveTotal")}</p>
                <p className="text-[12px] text-muted">
                  {t("company.ch.effectiveHint")}
                </p>
              </div>
              <span className="font-medium tabular-nums">
                {formatTaxRate(swiss.effectiveCombinedPercent, locale)} %
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-[10px] border border-line p-3">
        <p className="text-[13px] font-medium text-foreground">
          {t("company.ch.capitalTitle")}
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={settings.chCapitalTaxEnabled}
            onChange={(e) => patch({ chCapitalTaxEnabled: e.target.checked })}
            className="size-4 rounded border-line"
          />
          {t("company.ch.capitalEnable")}
        </label>
        {settings.chCapitalTaxEnabled ? (
          <Field
            label={t("company.field.chCapitalTax")}
            hint={t("company.field.chCapitalTaxHint")}
          >
            <NumField
              value={settings.chCapitalTaxPermille}
              onValueChange={(n) => patch({ chCapitalTaxPermille: n ?? 0 })}
            />
          </Field>
        ) : null}
        <p className="text-[12px] text-muted">
          {t("company.ch.capitalSeparate")}
          {swiss.capitalTaxPermille != null
            ? ` ${formatTaxRate(swiss.capitalTaxPermille, locale)} ‰`
            : ""}
        </p>
      </div>
    </div>
  );
}

function UsTaxSection({
  settings,
  patch,
  locale,
  t,
}: {
  settings: CompanySettings;
  patch: (partial: Partial<CompanySettings>) => void;
  locale: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const [localOpen, setLocalOpen] = useState(
    () => (settings.usLocalTaxPercent || 0) > 0,
  );
  const us = computeUsTaxBreakdown(settings);
  const states = listUsStateTaxRates();
  const ref = getUsStateTaxRate(settings.usStateCode);
  const federalEdited =
    Math.abs(
      settings.usFederalIncomeTaxPercent -
        US_FEDERAL_CORPORATE_TAX_PERCENT_DEFAULT,
    ) > 0.001;

  return (
    <div className="space-y-5">
      <Field
        label={t("company.field.usFederal")}
        hint={t("company.field.usFederalHint")}
      >
        <NumField
          value={settings.usFederalIncomeTaxPercent}
          onValueChange={(n) =>
            patch({ usFederalIncomeTaxPercent: n ?? 0 })
          }
        />
      </Field>
      {federalEdited ? (
        <p className="rounded-[8px] border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900/90">
          {t("company.us.federalEditWarn", {
            rate: formatTaxRate(US_FEDERAL_CORPORATE_TAX_PERCENT_DEFAULT, locale),
          })}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("company.field.usState")}>
          <Select
            value={settings.usStateCode}
            onChange={(e) => {
              const code = e.target.value;
              const next = getUsStateTaxRate(code);
              patch({
                usStateCode: code,
                usStateTaxPercent: isUsStateWithoutClassicCit(next)
                  ? 0
                  : (next?.rate_percent ?? 0),
              });
            }}
          >
            {states.map((s) => (
              <option key={s.state_code} value={s.state_code}>
                {s.state_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={t("company.field.usStateRate")}
          hint={
            us.graduated && us.rateRange
              ? t("company.us.graduatedHint", { range: us.rateRange })
              : t("company.field.usStateRateHint")
          }
        >
          <NumField
            value={settings.usStateTaxPercent}
            onValueChange={(n) => patch({ usStateTaxPercent: n ?? 0 })}
          />
        </Field>
      </div>

      {us.alternativeTaxOnly ? (
        <p className="rounded-[8px] border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900/90">
          {t("company.us.alternativeTaxWarn", {
            state: us.stateName || settings.usStateCode,
          })}
        </p>
      ) : null}

      <div className="space-y-3 rounded-[10px] border border-line p-3">
        <p className="text-[13px] font-medium text-foreground">
          {t("company.us.localTitle")}
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={localOpen}
            onChange={(e) => {
              const on = e.target.checked;
              setLocalOpen(on);
              if (!on) patch({ usLocalTaxPercent: 0 });
            }}
            className="size-4 rounded border-line"
          />
          {t("company.us.localEnable")}
        </label>
        {localOpen ? (
          <Field
            label={t("company.field.usLocalRate")}
            hint={t("company.field.usLocalRateHint")}
          >
            <NumField
              value={settings.usLocalTaxPercent}
              onValueChange={(n) => patch({ usLocalTaxPercent: n ?? 0 })}
            />
          </Field>
        ) : null}
      </div>

      <div className="rounded-[10px] border border-line p-3">
        <p className="mb-3 text-[13px] font-medium text-foreground">
          {t("company.us.breakdownTitle")}
        </p>
        {us.alternativeTaxOnly ? (
          <p className="text-[13px] leading-relaxed text-muted">
            {t("company.us.alternativeTaxCalc", {
              state: us.stateName || settings.usStateCode,
            })}
          </p>
        ) : (
          <div className="space-y-2.5 text-[13px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-muted">{t("company.us.line.federal")}</p>
                <p className="text-[12px] text-muted">
                  {t("company.us.formula.federal")}
                </p>
              </div>
              <span className="font-medium tabular-nums">
                {formatTaxRate(us.federalPercent, locale)} %
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-muted">{t("company.us.line.state")}</p>
                <p className="text-[12px] text-muted">
                  {t("company.us.formula.state", {
                    state: formatTaxRate(us.statePercent, locale),
                    federal: formatTaxRate(us.federalPercent, locale),
                  })}
                </p>
              </div>
              <span className="font-medium tabular-nums">
                {formatTaxRate(us.stateAfterFederalDeductionPercent, locale)} %
              </span>
            </div>
            {us.localPercent > 0 ? (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-muted">{t("company.us.line.local")}</p>
                  <p className="text-[12px] text-muted">
                    {t("company.us.formula.local", {
                      local: formatTaxRate(us.localPercent, locale),
                      federal: formatTaxRate(us.federalPercent, locale),
                    })}
                  </p>
                </div>
                <span className="font-medium tabular-nums">
                  {formatTaxRate(us.localAfterFederalDeductionPercent, locale)} %
                </span>
              </div>
            ) : null}
            <div className="border-t border-line pt-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-foreground">
                  {t("company.us.nominalTotal")}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatTaxRate(us.nominalCombinedPercent, locale)} %
                </span>
              </div>
              <p className="mt-1 text-[12px] text-muted">
                {t("company.us.combinedRateHint")}
              </p>
            </div>
          </div>
        )}
      </div>
      {ref ? (
        <p className="text-[11px] text-muted">
          {t("company.us.refYear", {
            year: String(usStateTaxRatesAsOfYear()),
          })}
        </p>
      ) : null}
    </div>
  );
}

function parseYearMonth(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

/** Kalender-Monats-Picker mit Jahr-Auswahl (Select + Pfeile). */
function MonthCalendarPicker({
  value,
  onChange,
  locale,
  emptyLabel,
  clearLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  locale: string;
  emptyLabel: string;
  clearLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const parsed = parseYearMonth(value);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [viewYear, setViewYear] = useState(
    () => parsed?.year ?? currentYear,
  );

  useEffect(() => {
    if (open) {
      setViewYear(parsed?.year ?? new Date().getFullYear());
    }
  }, [open, parsed?.year]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const years = useMemo(() => {
    const base = Array.from({ length: 61 }, (_, i) => currentYear - 40 + i);
    if (!base.includes(viewYear)) {
      return [...base, viewYear].sort((a, b) => a - b);
    }
    return base;
  }, [currentYear, viewYear]);

  const monthLabels = useMemo(() => {
    const long = new Intl.DateTimeFormat(locale, { month: "long" });
    const short = new Intl.DateTimeFormat(locale, { month: "short" });
    return Array.from({ length: 12 }, (_, i) => ({
      index: i + 1,
      long: long.format(new Date(2020, i, 1)),
      short: short.format(new Date(2020, i, 1)),
    }));
  }, [locale]);

  const displayLabel = parsed
    ? `${monthLabels[parsed.month - 1]?.long ?? ""} ${parsed.year}`
    : emptyLabel;

  const pickMonth = (monthIndex: number) => {
    onChange(`${viewYear}-${String(monthIndex).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-[8px] border border-line bg-white px-3 py-[7px] text-left text-[13px] text-foreground outline-none transition-[border-color,box-shadow] hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_3px_rgba(38,109,240,0.12)]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={parsed ? "" : "text-muted-soft"}>{displayLabel}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="shrink-0 text-muted-soft"
          aria-hidden
        >
          <rect
            x="1.75"
            y="2.5"
            width="10.5"
            height="9.5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M1.75 5.5h10.5M4.5 1.75v2M9.5 1.75v2"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="dialog"
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-[min(100%,280px)] rounded-[12px] border border-line bg-white p-3 shadow-[0_12px_40px_rgba(28,29,31,0.14)]"
        >
          <div className="mb-3 flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted hover:bg-surface-soft hover:text-foreground"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Previous year"
            >
              ‹
            </button>
            <select
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="h-8 min-w-0 flex-1 rounded-[8px] border border-line bg-white px-2 text-center text-[13px] font-medium outline-none hover:border-line-strong focus:border-accent"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted hover:bg-surface-soft hover:text-foreground"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Next year"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {monthLabels.map((m) => {
              const selected =
                parsed?.year === viewYear && parsed.month === m.index;
              const isCurrent =
                currentYear === viewYear && currentMonth === m.index;
              return (
                <button
                  key={m.index}
                  type="button"
                  onClick={() => pickMonth(m.index)}
                  className={`rounded-[8px] px-1 py-2 text-[12px] font-medium transition-colors ${
                    selected
                      ? "bg-foreground text-white"
                      : isCurrent
                        ? "bg-surface-soft text-foreground hover:bg-surface-faint"
                        : "text-foreground hover:bg-surface-soft"
                  }`}
                >
                  {m.short}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-end border-t border-line pt-2">
            <button
              type="button"
              className="rounded-[8px] px-2 py-1 text-[12px] font-medium text-muted hover:bg-surface-soft hover:text-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {clearLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CompanyPageClient() {
  const { ready, data, patchCompanySettings } = useStore();
  const { t, locale, numberFormat } = useI18n();
  const [tab, setTab] = useState<CompanyTab>("general");
  const [vatDeleteTarget, setVatDeleteTarget] = useState<VatRate | null>(null);

  const numberInputCtx = useMemo(
    () => ({ numberFormat, locale }),
    [numberFormat, locale],
  );

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const settings: CompanySettings = normalizeCompanySettings({
    ...EMPTY_COMPANY_SETTINGS,
    ...(data.companySettings ?? {}),
  });

  const patch = (partial: Partial<CompanySettings>) => {
    patchCompanySettings(partial);
  };

  const modelStartDateLabel = (() => {
    const key = settings.modelStartMonth;
    if (!/^\d{4}-\d{2}$/.test(key)) return t("common.emDash");
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(new Date(y, m - 1, 1));
  })();

  const sectionMeta: Record<
    CompanyTab,
    { title: MessageKey; hint: MessageKey }
  > = {
    general: {
      title: "company.section.general",
      hint: "company.section.generalHint",
    },
    starting: {
      title: "company.section.starting",
      hint: "company.section.startingHint",
    },
    taxes: {
      title: "company.section.taxes",
      hint: "company.section.taxesHint",
    },
    vat: {
      title: "company.section.vat",
      hint: "company.section.vatHint",
    },
    personnel: {
      title: "company.section.personnel",
      hint: "company.section.personnelHint",
    },
    valuation: {
      title: "company.section.valuation",
      hint: "company.section.valuationHint",
    },
  };

  const meta = sectionMeta[tab];

  return (
    <NumberInputCtx.Provider value={numberInputCtx}>
    <div>
      <ConfirmDialog
        open={Boolean(vatDeleteTarget)}
        onClose={() => setVatDeleteTarget(null)}
        title={t("company.vat.deleteTitle")}
        description={
          vatDeleteTarget
            ? t("company.vat.deleteDescription", {
                name:
                  vatDeleteTarget.name.trim() ||
                  `${formatTaxRate(vatDeleteTarget.ratePercent, locale)} %`,
              })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
        onConfirm={() => {
          if (!vatDeleteTarget) return;
          const nextRates = (settings.vatRates ?? []).filter(
            (r) => r.id !== vatDeleteTarget.id,
          );
          const nextDefault =
            settings.defaultVatRateId === vatDeleteTarget.id
              ? (nextRates[0]?.id ?? "")
              : settings.defaultVatRateId;
          patch({
            vatRates: nextRates,
            defaultVatRateId: nextDefault,
            vatRatePercent: resolveVatRatePercent({
              vatRates: nextRates,
              defaultVatRateId: nextDefault,
              vatRatePercent: settings.vatRatePercent,
            }),
          });
        }}
      />

      <PageHeader
        title={t("company.title")}
        description={t("company.description")}
      />

      <div className="mb-4 flex flex-wrap rounded-[8px] border border-line bg-white p-0.5">
        {COMPANY_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
              tab === item.id
                ? "bg-surface-soft text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      <Card>
        <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
          {t(meta.title)}
        </h2>
        <p className="mb-4 text-[13px] text-muted">{t(meta.hint)}</p>

        {tab === "general" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("company.field.companyName")}>
              <TextInput
                value={settings.companyName}
                onChange={(e) => patch({ companyName: e.target.value })}
                placeholder={t("company.field.companyNamePlaceholder")}
              />
            </Field>
            <Field label={t("company.field.baseCurrency")}>
              <Select
                value={settings.baseCurrency}
                onChange={(e) => patch({ baseCurrency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("company.field.modelStartMonth")}
              hint={t("company.field.monthHint")}
            >
              <MonthCalendarPicker
                value={settings.modelStartMonth}
                onChange={(modelStartMonth) => patch({ modelStartMonth })}
                locale={locale}
                emptyLabel={t("company.field.monthEmpty")}
                clearLabel={t("company.field.monthClear")}
              />
            </Field>
            <Field
              label={t("company.field.lastActualMonth")}
              hint={t("company.field.monthHint")}
            >
              <MonthCalendarPicker
                value={settings.lastActualMonth}
                onChange={(lastActualMonth) => patch({ lastActualMonth })}
                locale={locale}
                emptyLabel={t("company.field.monthEmpty")}
                clearLabel={t("company.field.monthClear")}
              />
            </Field>
          </div>
        ) : null}

        {tab === "starting" ? (
          <div className="space-y-4">
            {!settings.modelStartMonth ? (
              <p className="text-[13px] text-muted">
                {t("company.field.modelStartMissing")}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t("company.field.startingEquity", {
                  date: modelStartDateLabel,
                })}
              >
                <NumField
                  value={settings.startingEquity}
                  onValueChange={(n) => patch({ startingEquity: n ?? 0 })}
                />
              </Field>
              <Field
                label={t("company.field.startingCash", {
                  date: modelStartDateLabel,
                })}
              >
                <NumField
                  value={settings.startingCash}
                  onValueChange={(n) => patch({ startingCash: n ?? 0 })}
                />
              </Field>
              <Field
                label={t("company.field.vatOwedAtStart", {
                  date: modelStartDateLabel,
                })}
              >
                <NumField
                  value={settings.vatOwedAtStart}
                  onValueChange={(n) => patch({ vatOwedAtStart: n ?? 0 })}
                />
              </Field>
              <Field
                label={t("company.field.incomeTaxesOwedAtStart", {
                  date: modelStartDateLabel,
                })}
              >
                <NumField
                  value={settings.incomeTaxesOwedAtStart}
                  onValueChange={(n) =>
                    patch({ incomeTaxesOwedAtStart: n ?? 0 })
                  }
                />
              </Field>
            </div>
          </div>
        ) : null}

        {tab === "taxes" ? (
          <div className="space-y-5">
            <div className="rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-950">
              <p className="text-[13px] font-medium">
                {t("company.tax.legalNoticeTitle")}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-amber-900/90">
                {t("company.tax.legalNotice")}
              </p>
            </div>

            <Field label={t("company.field.taxRegime")}>
              <Select
                value={settings.taxRegime}
                onChange={(e) =>
                  patch({ taxRegime: e.target.value as TaxRegime })
                }
                className="max-w-sm"
              >
                {SELECTABLE_TAX_REGIMES.map((regime) => (
                  <option key={regime} value={regime}>
                    {t(`company.taxRegime.${regime}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("company.field.fiscalYearStart")}>
                <Select
                  value={String(settings.fiscalYearStartMonth)}
                  onChange={(e) =>
                    patch({ fiscalYearStartMonth: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Intl.DateTimeFormat(locale, { month: "long" }).format(
                        new Date(2020, m - 1, 1),
                      )}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("company.field.taxConsolidationMonth")}>
                <Select
                  value={String(settings.taxConsolidationMonth)}
                  onChange={(e) =>
                    patch({ taxConsolidationMonth: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Intl.DateTimeFormat(locale, { month: "long" }).format(
                        new Date(2020, m - 1, 1),
                      )}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("company.field.incomeTaxCadence")}>
                <Select
                  value={settings.incomeTaxPaymentCadence}
                  onChange={(e) =>
                    patch({
                      incomeTaxPaymentCadence: e.target
                        .value as VatFilingCadence,
                    })
                  }
                >
                  {VAT_FILING_CADENCES.map((c) => (
                    <option key={c} value={c}>
                      {t(`company.vatCadence.${c}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {settings.taxRegime === "de" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label={t("company.field.kst")}
                    hint={t("company.field.kstHint")}
                  >
                    <NumField
                      value={settings.koerperschaftsteuerPercent}
                      onValueChange={(n) =>
                        patch({ koerperschaftsteuerPercent: n ?? 0 })
                      }
                    />
                  </Field>
                  <Field
                    label={t("company.field.soli")}
                    hint={t("company.field.soliHint")}
                  >
                    <NumField
                      value={settings.solidaritaetszuschlagPercent}
                      onValueChange={(n) =>
                        patch({ solidaritaetszuschlagPercent: n ?? 0 })
                      }
                    />
                  </Field>
                  <Field
                    label={t("company.field.gewstMesszahl")}
                    hint={t("company.field.gewstMesszahlHint")}
                  >
                    <NumField
                      value={settings.gewerbesteuerMesszahlPercent}
                      onValueChange={(n) =>
                        patch({ gewerbesteuerMesszahlPercent: n ?? 0 })
                      }
                    />
                  </Field>
                  <Field
                    label={t("company.field.gewstHebesatz")}
                    hint={t("company.field.gewstHebesatzHint")}
                  >
                    <NumField
                      value={settings.gewerbesteuerHebesatz}
                      onValueChange={(n) =>
                        patch({ gewerbesteuerHebesatz: n ?? 0 })
                      }
                    />
                  </Field>
                </div>
                {(() => {
                  const de = computeGermanTaxBreakdown(settings);
                  return (
                    <div className="rounded-[10px] border border-line p-3">
                      <p className="mb-3 text-[13px] font-medium text-foreground">
                        {t("company.de.breakdownTitle")}
                      </p>
                      <div className="space-y-2.5 text-[13px]">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-muted">
                            {t("company.de.line.kst")}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatTaxRate(
                              de.koerperschaftsteuerPercent,
                              locale,
                            )}{" "}
                            %
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-muted">
                              {t("company.de.line.soli")}
                            </p>
                            <p className="text-[12px] text-muted">
                              {t("company.de.formula.soli", {
                                kst: formatTaxRate(
                                  de.koerperschaftsteuerPercent,
                                  locale,
                                ),
                                soli: formatTaxRate(
                                  de.solidaritaetszuschlagPercent,
                                  locale,
                                ),
                              })}
                            </p>
                          </div>
                          <span className="font-medium tabular-nums">
                            {formatTaxRate(de.soliAbsolutePercent, locale)} %
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-muted">
                              {t("company.de.line.gewst")}
                            </p>
                            <p className="text-[12px] text-muted">
                              {t("company.de.formula.gewst", {
                                messzahl: formatTaxRate(
                                  de.gewerbesteuerMesszahlPercent,
                                  locale,
                                ),
                                hebesatz: formatTaxRate(
                                  de.gewerbesteuerHebesatz,
                                  locale,
                                ),
                              })}
                            </p>
                          </div>
                          <span className="font-medium tabular-nums">
                            {formatTaxRate(
                              de.gewerbesteuerEffectivePercent,
                              locale,
                            )}{" "}
                            %
                          </span>
                        </div>
                        <div className="border-t border-line pt-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-medium text-foreground">
                              {t("company.de.nominalTotal")}
                            </span>
                            <span className="font-semibold tabular-nums">
                              {formatTaxRate(
                                de.nominalCombinedPercent,
                                locale,
                              )}{" "}
                              %
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-muted">
                            {t("company.de.combinedRateHint")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}

            {settings.taxRegime === "us" ? (
              <UsTaxSection
                settings={settings}
                patch={patch}
                locale={locale}
                t={t}
              />
            ) : null}

            {settings.taxRegime === "ch" ? (
              <SwissTaxSection settings={settings} patch={patch} locale={locale} t={t} />
            ) : null}

            {SIMPLE_TAX_REGIMES.includes(settings.taxRegime) ? (
              <div className="space-y-3">
                {settings.taxRegime === "other" ? (
                  <Field label={t("company.field.otherTaxCountry")}>
                    <TextInput
                      value={settings.otherTaxCountryName}
                      onChange={(e) =>
                        patch({ otherTaxCountryName: e.target.value })
                      }
                      placeholder={t(
                        "company.field.otherTaxCountryPlaceholder",
                      )}
                      className="max-w-sm"
                    />
                  </Field>
                ) : null}
                <Field
                  label={t("company.field.overallTaxRate")}
                  hint={t("company.field.overallTaxRateHint")}
                >
                  <NumField
                    value={settings.corporateTaxPercent}
                    onValueChange={(n) =>
                      patch({ corporateTaxPercent: n ?? 0 })
                    }
                  />
                </Field>
              </div>
            ) : null}

            {settings.taxRegime === "other" ? (
              <div className="rounded-[8px] bg-surface-soft px-3 py-2">
                <p className="text-[13px] font-medium text-foreground">
                  {t("company.combinedTaxRate", {
                    rate: formatNumber(
                      combinedIncomeTaxPercent(settings),
                      locale,
                    ),
                  })}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "vat" ? (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium text-foreground">
                    {t("company.vat.ratesTitle")}
                  </p>
                  <p className="text-[12px] text-muted">
                    {t("company.vat.ratesHint")}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    patch({
                      vatRates: [
                        ...(settings.vatRates ?? []),
                        emptyVatRate({
                          name: "",
                          ratePercent: 0,
                        }),
                      ],
                    })
                  }
                >
                  {t("company.vat.addRate")}
                </Button>
              </div>

              {(settings.vatRates ?? []).length === 0 ? (
                <p className="rounded-[8px] border border-dashed border-line px-3 py-6 text-center text-[13px] text-muted">
                  {t("company.vat.ratesEmpty")}
                </p>
              ) : (
                <div className="space-y-3">
                  {(settings.vatRates ?? []).map((row) => {
                    const updateRow = (patchRow: Partial<VatRate>) => {
                      const nextRates = (settings.vatRates ?? []).map((r) =>
                        r.id === row.id ? { ...r, ...patchRow } : r,
                      );
                      patch({
                        vatRates: nextRates,
                        vatRatePercent: resolveVatRatePercent({
                          vatRates: nextRates,
                          defaultVatRateId: settings.defaultVatRateId,
                          vatRatePercent: settings.vatRatePercent,
                        }),
                      });
                    };
                    const isDefault = settings.defaultVatRateId === row.id;
                    return (
                      <div
                        key={row.id}
                        className="rounded-[10px] border border-line p-3"
                      >
                        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                          <Field label={t("company.vat.col.name")}>
                            <TextInput
                              value={row.name}
                              onChange={(e) =>
                                updateRow({ name: e.target.value })
                              }
                              placeholder={t(
                                "company.vat.col.namePlaceholder",
                              )}
                            />
                          </Field>
                          <Field label={t("company.vat.col.rate")}>
                            <NumField
                              value={row.ratePercent}
                              onValueChange={(n) =>
                                updateRow({ ratePercent: n ?? 0 })
                              }
                            />
                          </Field>
                          <label className="mb-1 flex cursor-pointer items-center gap-2 pb-2 text-[13px]">
                            <input
                              type="radio"
                              name="defaultVatRate"
                              checked={isDefault}
                              onChange={() =>
                                patch({
                                  defaultVatRateId: row.id,
                                  vatRatePercent: Math.max(
                                    0,
                                    row.ratePercent || 0,
                                  ),
                                })
                              }
                              className="size-4 border-line"
                            />
                            {t("company.vat.default")}
                          </label>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="ghost"
                            onClick={() => setVatDeleteTarget(row)}
                          >
                            {t("common.delete")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-[12px] text-muted">
                {t("company.vat.defaultHint")}
              </p>
            </div>

            <Field label={t("company.field.vatCadence")}>
              <Select
                value={settings.vatFilingCadence}
                onChange={(e) =>
                  patch({
                    vatFilingCadence: e.target.value as VatFilingCadence,
                  })
                }
                className="max-w-sm"
              >
                {VAT_FILING_CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {t(`company.vatCadence.${c}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        {tab === "personnel" ? (
          <div className="space-y-5">
            <div className="rounded-[10px] border border-line p-3">
              <p className="mb-3 text-[13px] font-medium text-foreground">
                {t("company.personnel.mandatoryTitle")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("company.field.socialSecurity")}>
                  <NumField
                    value={settings.defaultSocialSecurityPercent}
                    onValueChange={(n) => {
                      const next = {
                        ...settings,
                        defaultSocialSecurityPercent: n ?? 0,
                      };
                      patch({
                        defaultSocialSecurityPercent: n ?? 0,
                        ...derivePersonnelAggregates(next),
                      });
                    }}
                  />
                </Field>
                <Field label={t("company.field.medicare")}>
                  <NumField
                    value={settings.defaultMedicarePercent}
                    onValueChange={(n) => {
                      const next = {
                        ...settings,
                        defaultMedicarePercent: n ?? 0,
                      };
                      patch({
                        defaultMedicarePercent: n ?? 0,
                        ...derivePersonnelAggregates(next),
                      });
                    }}
                  />
                </Field>
                <Field label={t("company.field.futa")}>
                  <NumField
                    value={settings.defaultFutaPercent}
                    onValueChange={(n) => {
                      const next = {
                        ...settings,
                        defaultFutaPercent: n ?? 0,
                      };
                      patch({
                        defaultFutaPercent: n ?? 0,
                        ...derivePersonnelAggregates(next),
                      });
                    }}
                  />
                </Field>
                <Field label={t("company.field.suta")}>
                  <NumField
                    value={settings.defaultSutaPercent}
                    onValueChange={(n) => {
                      const next = {
                        ...settings,
                        defaultSutaPercent: n ?? 0,
                      };
                      patch({
                        defaultSutaPercent: n ?? 0,
                        ...derivePersonnelAggregates(next),
                      });
                    }}
                  />
                </Field>
                <Field label={t("company.field.ett")}>
                  <NumField
                    value={settings.defaultEttPercent}
                    onValueChange={(n) => {
                      const next = {
                        ...settings,
                        defaultEttPercent: n ?? 0,
                      };
                      patch({
                        defaultEttPercent: n ?? 0,
                        ...derivePersonnelAggregates(next),
                      });
                    }}
                  />
                </Field>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-[8px] bg-surface-soft px-3 py-2 text-[13px]">
                <span className="font-medium text-foreground">
                  {t("company.personnel.mandatoryTotal")}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatTaxRate(
                    sumDefaultEmployerPayrollTaxes(settings),
                    locale,
                  )}{" "}
                  %
                </span>
              </div>
            </div>

            <div className="rounded-[10px] border border-line p-3">
              <p className="mb-3 text-[13px] font-medium text-foreground">
                {t("company.personnel.benefitsTitle")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("company.field.healthInsurance")}>
                  <NumField
                    value={settings.defaultHealthInsuranceAnnual}
                    onValueChange={(n) => {
                      const next = {
                        ...settings,
                        defaultHealthInsuranceAnnual: n ?? 0,
                      };
                      patch({
                        defaultHealthInsuranceAnnual: n ?? 0,
                        ...derivePersonnelAggregates(next),
                      });
                    }}
                  />
                </Field>
                <Field label={t("company.field.dentalVision")}>
                  <NumField
                    value={settings.defaultDentalVisionAnnual}
                    onValueChange={(n) => {
                      const next = {
                        ...settings,
                        defaultDentalVisionAnnual: n ?? 0,
                      };
                      patch({
                        defaultDentalVisionAnnual: n ?? 0,
                        ...derivePersonnelAggregates(next),
                      });
                    }}
                  />
                </Field>
                <Field label={t("company.field.match401k")}>
                  <NumField
                    value={settings.default401kMatchPercent}
                    onValueChange={(n) => {
                      const next = {
                        ...settings,
                        default401kMatchPercent: n ?? 0,
                      };
                      patch({
                        default401kMatchPercent: n ?? 0,
                        ...derivePersonnelAggregates(next),
                      });
                    }}
                  />
                </Field>
                <Field label={t("company.field.workersComp")}>
                  <NumField
                    value={settings.defaultWorkersCompPercent}
                    onValueChange={(n) => {
                      const next = {
                        ...settings,
                        defaultWorkersCompPercent: n ?? 0,
                      };
                      patch({
                        defaultWorkersCompPercent: n ?? 0,
                        ...derivePersonnelAggregates(next),
                      });
                    }}
                  />
                </Field>
                <Field label={t("company.field.otherPerks")}>
                  <NumField
                    value={settings.defaultOtherPerksAnnual}
                    onValueChange={(n) => {
                      const next = {
                        ...settings,
                        defaultOtherPerksAnnual: n ?? 0,
                      };
                      patch({
                        defaultOtherPerksAnnual: n ?? 0,
                        ...derivePersonnelAggregates(next),
                      });
                    }}
                  />
                </Field>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-[8px] bg-surface-soft px-3 py-2 text-[13px]">
                  <span className="font-medium text-foreground">
                    {t("company.personnel.benefitsAnnualTotal")}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatTaxRate(sumDefaultBenefitsAnnual(settings), locale)}{" "}
                    / {t("company.personnel.perYear")}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[8px] bg-surface-soft px-3 py-2 text-[13px]">
                  <span className="font-medium text-foreground">
                    {t("company.personnel.benefitsPercentTotal")}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatTaxRate(sumDefaultBenefitsPercent(settings), locale)}{" "}
                    %
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("company.field.defaultIncrease")}>
                <NumField
                  value={settings.defaultAnnualIncreasePercent}
                  onValueChange={(n) =>
                    patch({ defaultAnnualIncreasePercent: n ?? 0 })
                  }
                />
              </Field>
            </div>
          </div>
        ) : null}

        {tab === "valuation" ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("company.field.costOfEquity")}>
                <NumField
                  value={settings.costOfEquityPercent}
                  onValueChange={(n) =>
                    patch({ costOfEquityPercent: n ?? 0 })
                  }
                />
              </Field>
              <Field label={t("company.field.costOfDebt")}>
                <NumField
                  value={settings.costOfDebtPercent}
                  onValueChange={(n) => patch({ costOfDebtPercent: n ?? 0 })}
                />
              </Field>
              <Field label={t("company.field.valuationCorporateTax")}>
                <NumField
                  value={settings.valuationCorporateTaxPercent}
                  onValueChange={(n) =>
                    patch({ valuationCorporateTaxPercent: n ?? 0 })
                  }
                />
              </Field>
              <Field label={t("company.field.expectedMarketReturn")}>
                <NumField
                  value={settings.expectedMarketReturnPercent}
                  onValueChange={(n) =>
                    patch({ expectedMarketReturnPercent: n ?? 0 })
                  }
                />
              </Field>
              <Field label={t("company.field.riskFreeRate")}>
                <NumField
                  value={settings.riskFreeRatePercent}
                  onValueChange={(n) =>
                    patch({ riskFreeRatePercent: n ?? 0 })
                  }
                />
              </Field>
              <Field label={t("company.field.equityBeta")}>
                <NumField
                  value={settings.equityBeta}
                  onValueChange={(n) => patch({ equityBeta: n ?? 0 })}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("company.field.wacc")}>
                <NumField
                  value={settings.waccPercent}
                  emptyAs={null}
                  placeholder={t("common.emDash")}
                  onValueChange={(n) => patch({ waccPercent: n })}
                />
              </Field>
              <Field label={t("company.field.terminalGrowth")}>
                <NumField
                  value={settings.terminalGrowthPercent}
                  emptyAs={null}
                  placeholder={t("common.emDash")}
                  onValueChange={(n) => patch({ terminalGrowthPercent: n })}
                />
              </Field>
            </div>
          </div>
        ) : null}
      </Card>

      <p className="mt-3 text-[12px] text-muted-soft">{t("company.savedHint")}</p>
    </div>
    </NumberInputCtx.Provider>
  );
}

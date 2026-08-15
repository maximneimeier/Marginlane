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
  TAX_REGIMES,
  VAT_FILING_CADENCES,
  type CompanySettings,
  type NumberFormatStyle,
  type TaxRegime,
  type UsTaxJurisdiction,
  type VatFilingCadence,
} from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
import {
  emptyUsTaxJurisdiction,
  isAllowedNumberDraft,
  parseLocalizedNumber,
  combinedIncomeTaxPercent,
  deEffectiveGewerbesteuerPercent,
  chCantonalMunicipalPercent,
} from "@/lib/companySettings";
import { formatNumber } from "@/lib/format";
import { Button, Card, Field, PageHeader, Select, TextInput } from "@/components/ui";

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

  const numberInputCtx = useMemo(
    () => ({ numberFormat, locale }),
    [numberFormat, locale],
  );

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const settings: CompanySettings = {
    ...EMPTY_COMPANY_SETTINGS,
    ...(data.companySettings ?? {}),
  };

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
            <Field label={t("company.field.taxRegime")}>
              <Select
                value={settings.taxRegime}
                onChange={(e) =>
                  patch({ taxRegime: e.target.value as TaxRegime })
                }
                className="max-w-sm"
              >
                {TAX_REGIMES.map((regime) => (
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
                <p className="text-[13px] text-muted">
                  {t("company.de.gewstEffective", {
                    rate: formatNumber(
                      deEffectiveGewerbesteuerPercent(settings),
                      locale,
                    ),
                  })}
                </p>
              </div>
            ) : null}

            {settings.taxRegime === "us" ? (
              <div className="space-y-4">
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

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">
                        {t("company.us.jurisdictionsTitle")}
                      </p>
                      <p className="text-[12px] text-muted">
                        {t("company.us.jurisdictionsHint")}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        patch({
                          usTaxJurisdictions: [
                            ...(settings.usTaxJurisdictions ?? []),
                            emptyUsTaxJurisdiction(),
                          ],
                        })
                      }
                    >
                      {t("company.us.addJurisdiction")}
                    </Button>
                  </div>

                  {(settings.usTaxJurisdictions ?? []).length === 0 ? (
                    <p className="rounded-[8px] border border-dashed border-line px-3 py-6 text-center text-[13px] text-muted">
                      {t("company.us.jurisdictionsEmpty")}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {(settings.usTaxJurisdictions ?? []).map((row) => {
                        const updateRow = (
                          patchRow: Partial<UsTaxJurisdiction>,
                        ) => {
                          patch({
                            usTaxJurisdictions: (
                              settings.usTaxJurisdictions ?? []
                            ).map((j) =>
                              j.id === row.id ? { ...j, ...patchRow } : j,
                            ),
                          });
                        };
                        return (
                          <div
                            key={row.id}
                            className="rounded-[10px] border border-line p-3"
                          >
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <Field label={t("company.us.col.name")}>
                                <TextInput
                                  value={row.name}
                                  onChange={(e) =>
                                    updateRow({ name: e.target.value })
                                  }
                                  placeholder={t(
                                    "company.us.col.namePlaceholder",
                                  )}
                                />
                              </Field>
                              <Field label={t("company.us.col.rate")}>
                                <NumField
                                  value={row.incomeTaxPercent}
                                  onValueChange={(n) =>
                                    updateRow({ incomeTaxPercent: n ?? 0 })
                                  }
                                />
                              </Field>
                              <Field label={t("company.us.col.franchise")}>
                                <NumField
                                  value={row.franchiseTaxMin}
                                  onValueChange={(n) =>
                                    updateRow({ franchiseTaxMin: n ?? 0 })
                                  }
                                />
                              </Field>
                              <Field label={t("company.us.col.apportionment")}>
                                <NumField
                                  value={row.apportionmentPercent}
                                  onValueChange={(n) =>
                                    updateRow({
                                      apportionmentPercent: n ?? 0,
                                    })
                                  }
                                />
                              </Field>
                            </div>
                            <div className="mt-2 flex justify-end">
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  patch({
                                    usTaxJurisdictions: (
                                      settings.usTaxJurisdictions ?? []
                                    ).filter((j) => j.id !== row.id),
                                  })
                                }
                              >
                                {t("common.delete")}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {settings.taxRegime === "ch" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field
                    label={t("company.field.chFederal")}
                    hint={t("company.field.chFederalHint")}
                  >
                    <NumField
                      value={settings.chFederalTaxPercent}
                      onValueChange={(n) =>
                        patch({ chFederalTaxPercent: n ?? 0 })
                      }
                    />
                  </Field>
                  <Field
                    label={t("company.field.chCantonal")}
                    hint={t("company.field.chCantonalHint")}
                  >
                    <NumField
                      value={settings.chCantonalTaxPercent}
                      onValueChange={(n) =>
                        patch({ chCantonalTaxPercent: n ?? 0 })
                      }
                    />
                  </Field>
                  <Field
                    label={t("company.field.chMunicipalFoot")}
                    hint={t("company.field.chMunicipalFootHint")}
                  >
                    <NumField
                      value={settings.chMunicipalTaxFoot}
                      onValueChange={(n) =>
                        patch({ chMunicipalTaxFoot: n ?? 0 })
                      }
                    />
                  </Field>
                </div>
                <p className="text-[13px] text-muted">
                  {t("company.ch.cantonalMunicipal", {
                    rate: formatNumber(
                      chCantonalMunicipalPercent(settings),
                      locale,
                    ),
                  })}
                </p>
              </div>
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

            <div className="rounded-[8px] bg-surface-soft px-3 py-2">
              <p className="text-[13px] font-medium text-foreground">
                {t("company.combinedTaxRate", {
                  rate: formatNumber(
                    combinedIncomeTaxPercent(settings),
                    locale,
                  ),
                })}
              </p>
              {settings.taxRegime === "us" ? (
                <p className="mt-0.5 text-[12px] text-muted">
                  {t("company.us.combinedRateHint")}
                </p>
              ) : null}
              {settings.taxRegime === "de" ? (
                <p className="mt-0.5 text-[12px] text-muted">
                  {t("company.de.combinedRateHint")}
                </p>
              ) : null}
              {settings.taxRegime === "ch" ? (
                <p className="mt-0.5 text-[12px] text-muted">
                  {t("company.ch.combinedRateHint")}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "vat" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("company.field.vatRate")}>
              <NumField
                value={settings.vatRatePercent}
                onValueChange={(n) => patch({ vatRatePercent: n ?? 0 })}
              />
            </Field>
            <Field label={t("company.field.vatCadence")}>
              <Select
                value={settings.vatFilingCadence}
                onChange={(e) =>
                  patch({
                    vatFilingCadence: e.target.value as VatFilingCadence,
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
        ) : null}

        {tab === "personnel" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("company.field.defaultNk")}>
              <NumField
                value={settings.defaultLohnnebenkostenPercent}
                onValueChange={(n) =>
                  patch({ defaultLohnnebenkostenPercent: n ?? 0 })
                }
              />
            </Field>
            <Field label={t("company.field.defaultZusatz")}>
              <NumField
                value={settings.defaultZusatzAgPercent}
                onValueChange={(n) => patch({ defaultZusatzAgPercent: n ?? 0 })}
              />
            </Field>
            <Field label={t("company.field.defaultBenefits")}>
              <NumField
                value={settings.defaultBenefitsMonthly}
                onValueChange={(n) => patch({ defaultBenefitsMonthly: n ?? 0 })}
              />
            </Field>
            <Field label={t("company.field.defaultIncrease")}>
              <NumField
                value={settings.defaultAnnualIncreasePercent}
                onValueChange={(n) =>
                  patch({ defaultAnnualIncreasePercent: n ?? 0 })
                }
              />
            </Field>
          </div>
        ) : null}

        {tab === "valuation" ? (
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
        ) : null}
      </Card>

      <p className="mt-3 text-[12px] text-muted-soft">{t("company.savedHint")}</p>
    </div>
    </NumberInputCtx.Provider>
  );
}

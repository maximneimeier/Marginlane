import {
  CURRENCIES,
  DEFAULT_LOHNNEBENKOSTEN_PERCENT,
  type CompanySettings,
  type VatFilingCadence,
} from "./types";
import { EMPTY_COMPANY_SETTINGS, VAT_FILING_CADENCES } from "./types";

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalFiniteNumber(
  value: unknown,
  fallback: number | null,
): number | null {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function monthKey(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^\d{4}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function isVatFilingCadence(value: unknown): value is VatFilingCadence {
  return (
    typeof value === "string" &&
    (VAT_FILING_CADENCES as string[]).includes(value)
  );
}

export function normalizeCompanySettings(
  raw: Partial<CompanySettings> | null | undefined,
): CompanySettings {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_COMPANY_SETTINGS };
  }

  const currency =
    typeof raw.baseCurrency === "string" &&
    (CURRENCIES as readonly string[]).includes(raw.baseCurrency)
      ? raw.baseCurrency
      : EMPTY_COMPANY_SETTINGS.baseCurrency;

  return {
    companyName:
      typeof raw.companyName === "string" ? raw.companyName : "",
    baseCurrency: currency,
    modelStartMonth: monthKey(raw.modelStartMonth),
    lastActualMonth: monthKey(raw.lastActualMonth),
    startingEquity: finiteNumber(
      raw.startingEquity,
      EMPTY_COMPANY_SETTINGS.startingEquity,
    ),
    startingCash: finiteNumber(
      raw.startingCash,
      EMPTY_COMPANY_SETTINGS.startingCash,
    ),
    unpaidTaxesAtStart: finiteNumber(
      raw.unpaidTaxesAtStart,
      EMPTY_COMPANY_SETTINGS.unpaidTaxesAtStart,
    ),
    koerperschaftsteuerPercent: finiteNumber(
      raw.koerperschaftsteuerPercent,
      EMPTY_COMPANY_SETTINGS.koerperschaftsteuerPercent,
    ),
    solidaritaetszuschlagPercent: finiteNumber(
      raw.solidaritaetszuschlagPercent,
      EMPTY_COMPANY_SETTINGS.solidaritaetszuschlagPercent,
    ),
    gewerbesteuerPercent: finiteNumber(
      raw.gewerbesteuerPercent,
      EMPTY_COMPANY_SETTINGS.gewerbesteuerPercent,
    ),
    vatRatePercent: finiteNumber(
      raw.vatRatePercent,
      EMPTY_COMPANY_SETTINGS.vatRatePercent,
    ),
    vatFilingCadence: isVatFilingCadence(raw.vatFilingCadence)
      ? raw.vatFilingCadence
      : EMPTY_COMPANY_SETTINGS.vatFilingCadence,
    defaultLohnnebenkostenPercent: finiteNumber(
      raw.defaultLohnnebenkostenPercent,
      DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    ),
    defaultZusatzAgPercent: finiteNumber(
      raw.defaultZusatzAgPercent,
      EMPTY_COMPANY_SETTINGS.defaultZusatzAgPercent,
    ),
    defaultBenefitsMonthly: finiteNumber(
      raw.defaultBenefitsMonthly,
      EMPTY_COMPANY_SETTINGS.defaultBenefitsMonthly,
    ),
    defaultAnnualIncreasePercent: finiteNumber(
      raw.defaultAnnualIncreasePercent,
      EMPTY_COMPANY_SETTINGS.defaultAnnualIncreasePercent,
    ),
    waccPercent: optionalFiniteNumber(
      raw.waccPercent,
      EMPTY_COMPANY_SETTINGS.waccPercent,
    ),
    terminalGrowthPercent: optionalFiniteNumber(
      raw.terminalGrowthPercent,
      EMPTY_COMPANY_SETTINGS.terminalGrowthPercent,
    ),
  };
}

export type PersonnelCostDefaults = {
  lohnnebenkostenPercent: number;
  zusatzAgPercent: number;
  benefitsMonthly: number;
  annualIncreasePercent: number;
};

export function personnelDefaultsFromCompany(
  settings: CompanySettings | null | undefined,
): PersonnelCostDefaults {
  const s = settings
    ? normalizeCompanySettings(settings)
    : EMPTY_COMPANY_SETTINGS;
  return {
    lohnnebenkostenPercent: s.defaultLohnnebenkostenPercent,
    zusatzAgPercent: s.defaultZusatzAgPercent,
    benefitsMonthly: s.defaultBenefitsMonthly,
    annualIncreasePercent: s.defaultAnnualIncreasePercent,
  };
}

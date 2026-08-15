import {
  CURRENCIES,
  DEFAULT_LOHNNEBENKOSTEN_PERCENT,
  TAX_REGIMES,
  type CompanySettings,
  type NumberFormatStyle,
  type TaxRegime,
  type UsTaxJurisdiction,
  type VatFilingCadence,
} from "./types";
import { EMPTY_COMPANY_SETTINGS, VAT_FILING_CADENCES } from "./types";
import { createId } from "./format";
import {
  computeIncomeTax,
  computeSwissTax,
  deCombinedIncomeTaxPercent,
  deEffectiveGewerbesteuerPercent,
  usCombinedIncomeTaxPercent,
} from "./taxModels";

export {
  deCombinedIncomeTaxPercent,
  deEffectiveGewerbesteuerPercent,
  usCombinedIncomeTaxPercent,
};

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

function clampMonth(value: unknown, fallback: number): number {
  const n = finiteNumber(value, fallback);
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 12) return fallback;
  return rounded;
}

function isVatFilingCadence(value: unknown): value is VatFilingCadence {
  return (
    typeof value === "string" &&
    (VAT_FILING_CADENCES as string[]).includes(value)
  );
}

function isTaxRegime(value: unknown): value is TaxRegime {
  return (
    typeof value === "string" && (TAX_REGIMES as string[]).includes(value)
  );
}

export function numberLocaleTag(format: NumberFormatStyle): string {
  return format === "en" ? "en-US" : "de-DE";
}

/**
 * Parst Nutzereingaben je nach Schreibweise.
 * DE: 1.234,56 · EN: 1,234.56
 */
export function parseLocalizedNumber(
  raw: string,
  format: NumberFormatStyle,
): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-" || trimmed === "," || trimmed === ".") {
    return null;
  }
  let normalized = trimmed;
  if (format === "de") {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = trimmed.replace(/,/g, "");
  }
  if (normalized === "-" || normalized === "." || normalized === "-.") {
    return null;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Erlaubt Zwischeneingaben wie "-", "1,", "1.2" je nach Format. */
export function isAllowedNumberDraft(
  raw: string,
  format: NumberFormatStyle,
): boolean {
  if (raw === "" || raw.trim() === "") return true;
  // Erlaubt Zwischenstände beim Tippen/Löschen
  if (format === "de") {
    return /^-?\d{0,3}(\.\d{3})*([.,]\d*)?$|^-?\d+[.,]?\d*$|^-?[.,]?\d*$|^-$/.test(
      raw,
    );
  }
  return /^-?\d{0,3}(,\d{3})*(\.\d*)?$|^-?\d+\.?\d*$|^-?\.?\d*$|^-$/.test(raw);
}

export function emptyUsTaxJurisdiction(): UsTaxJurisdiction {
  return {
    id: createId("usj"),
    name: "",
    incomeTaxPercent: 0,
    franchiseTaxMin: 0,
    apportionmentPercent: 0,
  };
}

export function normalizeUsTaxJurisdiction(
  raw: Partial<UsTaxJurisdiction> | null | undefined,
): UsTaxJurisdiction {
  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : createId("usj"),
    name: typeof raw?.name === "string" ? raw.name : "",
    incomeTaxPercent: finiteNumber(raw?.incomeTaxPercent, 0),
    franchiseTaxMin: finiteNumber(raw?.franchiseTaxMin, 0),
    apportionmentPercent: finiteNumber(raw?.apportionmentPercent, 0),
  };
}

/**
 * Nominale CH-Gesamtsteuerbelastung vor Steuerabzug
 * (Bund + kantonal effektiv + gemeindlich effektiv).
 */
export function chCombinedIncomeTaxPercent(
  settings: CompanySettings,
): number {
  return computeSwissTax(settings).nominalCombinedPercent;
}

/**
 * Planungs-Ertragsteuersatz je Regime.
 * Schweiz: effektiver Satz bei abzugsfähiger Gewinnsteuer
 * (nominal / (1 + nominal/100)); andere Regime: nominal.
 */
export function combinedIncomeTaxPercent(
  settings: CompanySettings,
): number {
  return computeIncomeTax(settings).effectiveCombinedPercent;
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

  const usTaxJurisdictions = Array.isArray(raw.usTaxJurisdictions)
    ? raw.usTaxJurisdictions.map((row) =>
        normalizeUsTaxJurisdiction(
          (row ?? {}) as Partial<UsTaxJurisdiction>,
        ),
      )
    : [];

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
    vatOwedAtStart: finiteNumber(
      (raw as { vatOwedAtStart?: unknown }).vatOwedAtStart,
      EMPTY_COMPANY_SETTINGS.vatOwedAtStart,
    ),
    incomeTaxesOwedAtStart: (() => {
      const next = (raw as { incomeTaxesOwedAtStart?: unknown })
        .incomeTaxesOwedAtStart;
      if (typeof next === "number" && Number.isFinite(next)) return next;
      const legacy = (raw as { unpaidTaxesAtStart?: unknown })
        .unpaidTaxesAtStart;
      return finiteNumber(legacy, EMPTY_COMPANY_SETTINGS.incomeTaxesOwedAtStart);
    })(),
    taxRegime: (() => {
      if (isTaxRegime(raw.taxRegime)) return raw.taxRegime;
      const legacy = (raw as { taxRegime?: string }).taxRegime;
      // Legacy-Regime → Anderes Land
      if (legacy === "at" || legacy === "uk" || legacy === "nl") return "other";
      return EMPTY_COMPANY_SETTINGS.taxRegime;
    })(),
    fiscalYearStartMonth: clampMonth(
      raw.fiscalYearStartMonth,
      EMPTY_COMPANY_SETTINGS.fiscalYearStartMonth,
    ),
    taxConsolidationMonth: clampMonth(
      raw.taxConsolidationMonth,
      EMPTY_COMPANY_SETTINGS.taxConsolidationMonth,
    ),
    incomeTaxPaymentCadence: isVatFilingCadence(raw.incomeTaxPaymentCadence)
      ? raw.incomeTaxPaymentCadence
      : EMPTY_COMPANY_SETTINGS.incomeTaxPaymentCadence,
    koerperschaftsteuerPercent: finiteNumber(
      raw.koerperschaftsteuerPercent,
      EMPTY_COMPANY_SETTINGS.koerperschaftsteuerPercent,
    ),
    solidaritaetszuschlagPercent: finiteNumber(
      raw.solidaritaetszuschlagPercent,
      EMPTY_COMPANY_SETTINGS.solidaritaetszuschlagPercent,
    ),
    gewerbesteuerMesszahlPercent: finiteNumber(
      raw.gewerbesteuerMesszahlPercent,
      EMPTY_COMPANY_SETTINGS.gewerbesteuerMesszahlPercent,
    ),
    gewerbesteuerHebesatz: (() => {
      if (
        typeof raw.gewerbesteuerHebesatz === "number" &&
        Number.isFinite(raw.gewerbesteuerHebesatz)
      ) {
        return raw.gewerbesteuerHebesatz;
      }
      const legacyEff = (raw as { gewerbesteuerPercent?: unknown })
        .gewerbesteuerPercent;
      const messzahl = finiteNumber(
        raw.gewerbesteuerMesszahlPercent,
        EMPTY_COMPANY_SETTINGS.gewerbesteuerMesszahlPercent,
      );
      if (
        typeof legacyEff === "number" &&
        Number.isFinite(legacyEff) &&
        messzahl > 0
      ) {
        return (legacyEff / messzahl) * 100;
      }
      return EMPTY_COMPANY_SETTINGS.gewerbesteuerHebesatz;
    })(),
    usFederalIncomeTaxPercent: finiteNumber(
      raw.usFederalIncomeTaxPercent,
      EMPTY_COMPANY_SETTINGS.usFederalIncomeTaxPercent,
    ),
    usTaxJurisdictions,
    chFederalTaxPercent: finiteNumber(
      raw.chFederalTaxPercent,
      EMPTY_COMPANY_SETTINGS.chFederalTaxPercent,
    ),
    chCantonalTaxPercent: finiteNumber(
      raw.chCantonalTaxPercent,
      EMPTY_COMPANY_SETTINGS.chCantonalTaxPercent,
    ),
    chCantonalTaxFoot: finiteNumber(
      (raw as { chCantonalTaxFoot?: unknown }).chCantonalTaxFoot,
      EMPTY_COMPANY_SETTINGS.chCantonalTaxFoot,
    ),
    chMunicipalTaxFoot: finiteNumber(
      raw.chMunicipalTaxFoot,
      EMPTY_COMPANY_SETTINGS.chMunicipalTaxFoot,
    ),
    chCapitalTaxEnabled: Boolean(
      (raw as { chCapitalTaxEnabled?: unknown }).chCapitalTaxEnabled,
    ),
    chCapitalTaxPermille: finiteNumber(
      (raw as { chCapitalTaxPermille?: unknown }).chCapitalTaxPermille,
      EMPTY_COMPANY_SETTINGS.chCapitalTaxPermille,
    ),
    corporateTaxPercent: finiteNumber(
      raw.corporateTaxPercent,
      EMPTY_COMPANY_SETTINGS.corporateTaxPercent,
    ),
    otherTaxCountryName: (() => {
      if (
        typeof raw.otherTaxCountryName === "string" &&
        raw.otherTaxCountryName.trim()
      ) {
        return raw.otherTaxCountryName;
      }
      const legacy = (raw as { taxRegime?: string }).taxRegime;
      if (legacy === "at") return "Österreich";
      if (legacy === "uk") return "Vereinigtes Königreich";
      if (legacy === "nl") return "Niederlande";
      return "";
    })(),
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

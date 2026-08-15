import {
  CURRENCIES,
  DEFAULT_LOHNNEBENKOSTEN_PERCENT,
  TAX_REGIMES,
  type CompanySettings,
  type NumberFormatStyle,
  type PersonnelDefaultKind,
  type PersonnelDefaultLine,
  type PersonnelDefaultUnit,
  type TaxRegime,
  type UsTaxJurisdiction,
  type VatFilingCadence,
  type VatRate,
} from "./types";
import { EMPTY_COMPANY_SETTINGS, VAT_FILING_CADENCES } from "./types";
import { createId } from "./format";
import {
  computeIncomeTax,
  computeSwissTax,
  deCombinedIncomeTaxPercent,
  deEffectiveGewerbesteuerPercent,
  getUsStateTaxRate,
  isUsStateWithoutClassicCit,
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

/** Erster Kalendertag eines Monats YYYY-MM → YYYY-MM-DD. */
export function monthKeyToStartDate(month: string): string | null {
  const key = monthKey(month);
  return key ? `${key}-01` : null;
}

/** Letzter Kalendertag eines Monats YYYY-MM → YYYY-MM-DD. */
export function monthKeyToEndDate(month: string): string | null {
  const key = monthKey(month);
  if (!key) return null;
  const year = Number(key.slice(0, 4));
  const mon = Number(key.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return `${key}-${String(lastDay).padStart(2, "0")}`;
}

/** Datum in [min, max] klemmen (ISO YYYY-MM-DD). Leere Werte bleiben null. */
export function clampIsoDate(
  value: string | null,
  min: string | null | undefined,
  max: string | null | undefined,
): string | null {
  if (!value) return null;
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

/** Früheres von zwei ISO-Daten (null = egal). */
export function earlierIsoDate(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a < b ? a : b;
}

/** Späteres von zwei ISO-Daten (null = egal). */
export function laterIsoDate(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
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

export function emptyVatRate(partial?: Partial<VatRate>): VatRate {
  return {
    id: typeof partial?.id === "string" && partial.id ? partial.id : createId("vat"),
    name: typeof partial?.name === "string" ? partial.name : "",
    ratePercent: finiteNumber(partial?.ratePercent, 0),
  };
}

export function normalizeVatRate(
  raw: Partial<VatRate> | null | undefined,
): VatRate {
  return emptyVatRate(raw ?? undefined);
}

/** Standard-USt-Sätze (DE-typisch) für neue Workspaces / leere Listen */
export function defaultVatRates(): VatRate[] {
  return EMPTY_COMPANY_SETTINGS.vatRates.map((r) => ({ ...r }));
}

export function normalizeVatRates(
  raw: unknown,
  legacyRatePercent: number,
): VatRate[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((row) =>
      normalizeVatRate((row ?? {}) as Partial<VatRate>),
    );
  }
  // Legacy: ein einzelner vatRatePercent → Liste aufbauen
  const rate = Math.max(0, legacyRatePercent);
  const rates: VatRate[] = [
    {
      id: "vat_standard",
      name: "Regelsteuersatz",
      ratePercent: rate > 0 ? rate : 19,
    },
  ];
  if (rate === 19 || rate === 0) {
    rates.push({
      id: "vat_reduced",
      name: "Ermäßigter Steuersatz",
      ratePercent: 7,
    });
    rates.push({
      id: "vat_zero",
      name: "Steuerfrei / 0 %",
      ratePercent: 0,
    });
  }
  return rates;
}

export function resolveDefaultVatRateId(
  rates: VatRate[],
  preferredId: unknown,
): string {
  if (
    typeof preferredId === "string" &&
    preferredId &&
    rates.some((r) => r.id === preferredId)
  ) {
    return preferredId;
  }
  return rates[0]?.id ?? "";
}

export function resolveVatRatePercent(
  settings: Pick<CompanySettings, "vatRates" | "defaultVatRateId" | "vatRatePercent">,
): number {
  const rates = settings.vatRates ?? [];
  const match = rates.find((r) => r.id === settings.defaultVatRateId);
  if (match) return Math.max(0, match.ratePercent || 0);
  if (rates[0]) return Math.max(0, rates[0].ratePercent || 0);
  return Math.max(0, settings.vatRatePercent || 0);
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
      if (isTaxRegime(raw.taxRegime)) {
        // CH/US vorerst nicht wählbar → Anderes Land
        if (raw.taxRegime === "ch" || raw.taxRegime === "us") return "other";
        return raw.taxRegime;
      }
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
    ...(() => {
      const usTaxJurisdictions = Array.isArray(raw.usTaxJurisdictions)
        ? raw.usTaxJurisdictions.map((row) =>
            normalizeUsTaxJurisdiction(
              (row ?? {}) as Partial<UsTaxJurisdiction>,
            ),
          )
        : [];
      const rawCode =
        typeof (raw as { usStateCode?: unknown }).usStateCode === "string"
          ? (raw as { usStateCode: string }).usStateCode.trim().toUpperCase()
          : "";
      const ref = getUsStateTaxRate(rawCode);
      const usStateCode =
        rawCode && ref
          ? rawCode
          : EMPTY_COMPANY_SETTINGS.usStateCode;

      let usStateTaxPercent: number;
      if (
        typeof (raw as { usStateTaxPercent?: unknown }).usStateTaxPercent ===
          "number" &&
        Number.isFinite((raw as { usStateTaxPercent: number }).usStateTaxPercent)
      ) {
        usStateTaxPercent = Math.max(
          0,
          (raw as { usStateTaxPercent: number }).usStateTaxPercent,
        );
      } else if (usTaxJurisdictions[0]) {
        usStateTaxPercent = Math.max(
          0,
          usTaxJurisdictions[0].incomeTaxPercent || 0,
        );
      } else {
        const fallbackRef = getUsStateTaxRate(usStateCode);
        usStateTaxPercent = isUsStateWithoutClassicCit(fallbackRef)
          ? 0
          : finiteNumber(
              fallbackRef?.rate_percent,
              EMPTY_COMPANY_SETTINGS.usStateTaxPercent,
            );
      }

      if (isUsStateWithoutClassicCit(getUsStateTaxRate(usStateCode))) {
        usStateTaxPercent = 0;
      }

      const usLocalTaxPercent = finiteNumber(
        (raw as { usLocalTaxPercent?: unknown }).usLocalTaxPercent,
        EMPTY_COMPANY_SETTINGS.usLocalTaxPercent,
      );

      return {
        usStateCode,
        usStateTaxPercent,
        usLocalTaxPercent,
        usTaxJurisdictions,
      };
    })(),
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
      if (legacy === "ch") return "Schweiz";
      if (legacy === "us") return "USA";
      return "";
    })(),
    ...(() => {
      const legacyRate = finiteNumber(
        raw.vatRatePercent,
        EMPTY_COMPANY_SETTINGS.vatRatePercent,
      );
      const vatRates = normalizeVatRates(
        (raw as { vatRates?: unknown }).vatRates,
        legacyRate,
      );
      const defaultVatRateId = resolveDefaultVatRateId(
        vatRates,
        (raw as { defaultVatRateId?: unknown }).defaultVatRateId,
      );
      const vatRatePercent = resolveVatRatePercent({
        vatRates,
        defaultVatRateId,
        vatRatePercent: legacyRate,
      });
      return { vatRates, defaultVatRateId, vatRatePercent };
    })(),
    vatFilingCadence: isVatFilingCadence(raw.vatFilingCadence)
      ? raw.vatFilingCadence
      : EMPTY_COMPANY_SETTINGS.vatFilingCadence,
    ...(() => {
      const lines = normalizePersonnelDefaultLines(raw);
      return {
        personnelDefaultLines: lines,
        ...derivePersonnelAggregatesFromLines(lines),
      };
    })(),
    defaultAnnualIncreasePercent: finiteNumber(
      raw.defaultAnnualIncreasePercent,
      EMPTY_COMPANY_SETTINGS.defaultAnnualIncreasePercent,
    ),
    costOfEquityPercent: finiteNumber(
      (raw as { costOfEquityPercent?: unknown }).costOfEquityPercent,
      EMPTY_COMPANY_SETTINGS.costOfEquityPercent,
    ),
    costOfDebtPercent: finiteNumber(
      (raw as { costOfDebtPercent?: unknown }).costOfDebtPercent,
      EMPTY_COMPANY_SETTINGS.costOfDebtPercent,
    ),
    valuationCorporateTaxPercent: finiteNumber(
      (raw as { valuationCorporateTaxPercent?: unknown })
        .valuationCorporateTaxPercent,
      EMPTY_COMPANY_SETTINGS.valuationCorporateTaxPercent,
    ),
    expectedMarketReturnPercent: finiteNumber(
      (raw as { expectedMarketReturnPercent?: unknown })
        .expectedMarketReturnPercent,
      EMPTY_COMPANY_SETTINGS.expectedMarketReturnPercent,
    ),
    riskFreeRatePercent: finiteNumber(
      (raw as { riskFreeRatePercent?: unknown }).riskFreeRatePercent,
      EMPTY_COMPANY_SETTINGS.riskFreeRatePercent,
    ),
    equityBeta: finiteNumber(
      (raw as { equityBeta?: unknown }).equityBeta,
      EMPTY_COMPANY_SETTINGS.equityBeta,
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

const PERSONNEL_DEFAULT_UNITS: PersonnelDefaultUnit[] = [
  "percent",
  "annual",
  "monthly",
];

function isPersonnelDefaultUnit(value: unknown): value is PersonnelDefaultUnit {
  return (
    typeof value === "string" &&
    PERSONNEL_DEFAULT_UNITS.includes(value as PersonnelDefaultUnit)
  );
}

function isPersonnelDefaultKind(value: unknown): value is PersonnelDefaultKind {
  return value === "mandatory" || value === "benefit";
}

export function emptyPersonnelDefaultLine(
  kind: PersonnelDefaultKind,
): PersonnelDefaultLine {
  return {
    id: createId("pdl"),
    name: "",
    kind,
    unit: kind === "mandatory" ? "percent" : "annual",
    value: 0,
  };
}

export function normalizePersonnelDefaultLine(
  raw: Partial<PersonnelDefaultLine> | null | undefined,
  fallbackKind: PersonnelDefaultKind = "benefit",
): PersonnelDefaultLine {
  const kind = isPersonnelDefaultKind(raw?.kind) ? raw.kind : fallbackKind;
  const unitRaw = isPersonnelDefaultUnit(raw?.unit) ? raw.unit : undefined;
  const unit: PersonnelDefaultUnit =
    kind === "mandatory" ? "percent" : (unitRaw ?? "annual");
  return {
    id:
      typeof raw?.id === "string" && raw.id.trim()
        ? raw.id
        : createId("pdl"),
    name: typeof raw?.name === "string" ? raw.name : "",
    kind,
    unit,
    value: Math.max(0, finiteNumber(raw?.value, 0)),
  };
}

/** Legacy-Felder → Zeilen (einmalig bei Migration). */
function legacyPersonnelDefaultLines(raw: Record<string, unknown>): PersonnelDefaultLine[] {
  const lines: PersonnelDefaultLine[] = [];
  const pushPct = (name: string, key: string) => {
    const v = finiteNumber(raw[key], NaN);
    if (!Number.isFinite(v) || v === 0) return;
    lines.push({
      id: createId("pdl"),
      name,
      kind: "mandatory",
      unit: "percent",
      value: v,
    });
  };
  const pushBenefitPct = (name: string, key: string) => {
    const v = finiteNumber(raw[key], NaN);
    if (!Number.isFinite(v) || v === 0) return;
    lines.push({
      id: createId("pdl"),
      name,
      kind: "benefit",
      unit: "percent",
      value: v,
    });
  };
  const pushAnnual = (name: string, key: string) => {
    const v = finiteNumber(raw[key], NaN);
    if (!Number.isFinite(v) || v === 0) return;
    lines.push({
      id: createId("pdl"),
      name,
      kind: "benefit",
      unit: "annual",
      value: v,
    });
  };

  pushPct("Social Security", "defaultSocialSecurityPercent");
  pushPct("Medicare", "defaultMedicarePercent");
  pushPct("FUTA", "defaultFutaPercent");
  pushPct("SUTA", "defaultSutaPercent");
  pushPct("ETT", "defaultEttPercent");
  pushAnnual("Health Insurance", "defaultHealthInsuranceAnnual");
  pushAnnual("Dental & Vision", "defaultDentalVisionAnnual");
  pushAnnual("Other perks", "defaultOtherPerksAnnual");
  pushBenefitPct("401(k) match", "default401kMatchPercent");
  pushBenefitPct("Workers' Comp", "defaultWorkersCompPercent");

  // Noch ältere Einzel-Aggregate ohne Aufschlüsselung
  if (lines.length === 0) {
    const nk = finiteNumber(raw.defaultLohnnebenkostenPercent, NaN);
    if (Number.isFinite(nk) && nk > 0) {
      lines.push({
        id: createId("pdl"),
        name: "Lohnnebenkosten",
        kind: "mandatory",
        unit: "percent",
        value: nk,
      });
    }
    const zusatz = finiteNumber(raw.defaultZusatzAgPercent, NaN);
    if (Number.isFinite(zusatz) && zusatz > 0) {
      lines.push({
        id: createId("pdl"),
        name: "Zusatz AG",
        kind: "benefit",
        unit: "percent",
        value: zusatz,
      });
    }
    const benefits = finiteNumber(raw.defaultBenefitsMonthly, NaN);
    if (Number.isFinite(benefits) && benefits > 0) {
      lines.push({
        id: createId("pdl"),
        name: "Benefits",
        kind: "benefit",
        unit: "monthly",
        value: benefits,
      });
    }
  }

  return lines;
}

export function normalizePersonnelDefaultLines(
  raw: Partial<CompanySettings> | null | undefined,
): PersonnelDefaultLine[] {
  const record = (raw ?? {}) as Record<string, unknown>;
  if (Array.isArray(record.personnelDefaultLines)) {
    return (record.personnelDefaultLines as unknown[])
      .filter((item) => item && typeof item === "object")
      .map((item) =>
        normalizePersonnelDefaultLine(
          item as Partial<PersonnelDefaultLine>,
        ),
      );
  }
  return legacyPersonnelDefaultLines(record);
}

export function sumMandatoryPercent(lines: PersonnelDefaultLine[]): number {
  return lines
    .filter((l) => l.kind === "mandatory" && l.unit === "percent")
    .reduce((sum, l) => sum + Math.max(0, l.value || 0), 0);
}

export function sumBenefitPercent(lines: PersonnelDefaultLine[]): number {
  return lines
    .filter((l) => l.kind === "benefit" && l.unit === "percent")
    .reduce((sum, l) => sum + Math.max(0, l.value || 0), 0);
}

export function sumBenefitMonthly(lines: PersonnelDefaultLine[]): number {
  let monthly = 0;
  for (const line of lines) {
    if (line.kind !== "benefit") continue;
    const v = Math.max(0, line.value || 0);
    if (line.unit === "annual") monthly += v / 12;
    else if (line.unit === "monthly") monthly += v;
  }
  return monthly;
}

export function derivePersonnelAggregatesFromLines(
  lines: PersonnelDefaultLine[],
): {
  defaultLohnnebenkostenPercent: number;
  defaultZusatzAgPercent: number;
  defaultBenefitsMonthly: number;
} {
  return {
    defaultLohnnebenkostenPercent: sumMandatoryPercent(lines),
    defaultZusatzAgPercent: sumBenefitPercent(lines),
    defaultBenefitsMonthly: sumBenefitMonthly(lines),
  };
}

/** @deprecated Use derivePersonnelAggregatesFromLines */
export function derivePersonnelAggregates(
  settings: CompanySettings | {
    personnelDefaultLines?: PersonnelDefaultLine[];
  },
): {
  defaultLohnnebenkostenPercent: number;
  defaultZusatzAgPercent: number;
  defaultBenefitsMonthly: number;
} {
  const lines = Array.isArray(settings.personnelDefaultLines)
    ? settings.personnelDefaultLines
    : [];
  return derivePersonnelAggregatesFromLines(lines);
}

export function personnelDefaultsFromCompany(
  settings: CompanySettings | null | undefined,
): PersonnelCostDefaults {
  const s = settings
    ? normalizeCompanySettings(settings)
    : EMPTY_COMPANY_SETTINGS;
  return {
    lohnnebenkostenPercent:
      s.defaultLohnnebenkostenPercent || DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: s.defaultZusatzAgPercent,
    benefitsMonthly: s.defaultBenefitsMonthly,
    annualIncreasePercent: s.defaultAnnualIncreasePercent,
  };
}

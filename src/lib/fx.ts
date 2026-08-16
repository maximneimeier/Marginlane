import type { CompanySettings } from "./types";
import { CURRENCIES } from "./types";

/**
 * Referenzkurse: Einheiten EUR pro 1 Einheit Fremdwährung.
 * Planungswerte — keine Live-Marktdaten.
 */
export const EUR_CROSS_RATES: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  CNY: 0.127,
  GBP: 1.17,
  CHF: 1.04,
  JPY: 0.0062,
  HKD: 0.118,
};

/** Default: Einheiten BaseCurrency pro 1 Einheit Fremdwährung */
export function defaultFxRatesForBase(
  baseCurrency: string,
): Record<string, number> {
  const baseToEur = EUR_CROSS_RATES[baseCurrency] ?? 1;
  const out: Record<string, number> = {};
  for (const code of CURRENCIES) {
    const toEur = EUR_CROSS_RATES[code] ?? 1;
    out[code] = code === baseCurrency ? 1 : toEur / baseToEur;
  }
  return out;
}

/**
 * Kurs: wie viele Einheiten `baseCurrency` für 1 Einheit `currency`.
 * Batch-Override hat Vorrang, dann Company.fxRates, dann Default-Kreuzkurs.
 */
export function fxRateToBase(
  currency: string,
  baseCurrency: string,
  companyRates: Record<string, number> | undefined,
  batchOverride: number | null | undefined,
): number {
  if (!currency || currency === baseCurrency) return 1;
  if (
    typeof batchOverride === "number" &&
    Number.isFinite(batchOverride) &&
    batchOverride > 0
  ) {
    return batchOverride;
  }
  const custom = companyRates?.[currency];
  if (typeof custom === "number" && Number.isFinite(custom) && custom > 0) {
    return custom;
  }
  const defaults = defaultFxRatesForBase(baseCurrency);
  return defaults[currency] ?? 1;
}

export function convertToBase(
  amount: number,
  currency: string,
  baseCurrency: string,
  companyRates?: Record<string, number>,
  batchOverride?: number | null,
): number {
  return (
    amount *
    fxRateToBase(currency, baseCurrency, companyRates, batchOverride)
  );
}

export function resolveFxContext(settings: CompanySettings | null | undefined): {
  baseCurrency: string;
  rates: Record<string, number>;
} {
  const baseCurrency = settings?.baseCurrency || "EUR";
  const defaults = defaultFxRatesForBase(baseCurrency);
  const merged = { ...defaults, ...(settings?.fxRates ?? {}) };
  merged[baseCurrency] = 1;
  return { baseCurrency, rates: merged };
}

export function normalizeFxRates(
  raw: unknown,
  baseCurrency: string,
): Record<string, number> {
  const defaults = defaultFxRatesForBase(baseCurrency);
  if (!raw || typeof raw !== "object") return defaults;
  const out = { ...defaults };
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (
      (CURRENCIES as readonly string[]).includes(key) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0
    ) {
      out[key] = value;
    }
  }
  out[baseCurrency] = 1;
  return out;
}

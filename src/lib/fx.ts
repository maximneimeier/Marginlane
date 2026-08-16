import type { CompanySettings, FxRateHistoryEntry } from "./types";
import { CURRENCIES } from "./types";
import { createId } from "./format";

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

export function normalizeFxRateHistory(
  raw: unknown,
  baseCurrency: string,
): FxRateHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: FxRateHistoryEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<FxRateHistoryEntry>;
    const date = typeof r.date === "string" ? r.date.slice(0, 10) : "";
    if (!date) continue;
    entries.push({
      id: typeof r.id === "string" ? r.id : createId("fxh"),
      date,
      rates: normalizeFxRates(r.rates, baseCurrency),
      note: typeof r.note === "string" ? r.note : "",
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/** Kurse zum Stichtag: jüngster History-Eintrag ≤ date, sonst aktuelle fxRates */
export function ratesAsOf(
  settings: CompanySettings | null | undefined,
  asOfDate: string | null | undefined,
): Record<string, number> {
  const baseCurrency = settings?.baseCurrency || "EUR";
  const defaults = defaultFxRatesForBase(baseCurrency);
  const current = { ...defaults, ...(settings?.fxRates ?? {}) };
  current[baseCurrency] = 1;

  const day = (asOfDate || "").slice(0, 10);
  if (!day) return current;

  const history = settings?.fxRateHistory ?? [];
  const hit = history
    .filter((e) => e.date <= day)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!hit) return current;
  return { ...defaults, ...hit.rates, [baseCurrency]: 1 };
}

/**
 * Kurs: wie viele Einheiten `baseCurrency` für 1 Einheit `currency`.
 * Batch-Override hat Vorrang, dann Company-Kurse (ggf. historisch).
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

export function resolveFxContext(
  settings: CompanySettings | null | undefined,
  asOfDate?: string | null,
): {
  baseCurrency: string;
  rates: Record<string, number>;
} {
  const baseCurrency = settings?.baseCurrency || "EUR";
  return {
    baseCurrency,
    rates: ratesAsOf(settings, asOfDate),
  };
}

/** CSV: date,USD,CNY,... — erste Spalte Datum, Rest Kurse */
export function parseFxRatesCsv(
  csv: string,
  baseCurrency: string,
): FxRateHistoryEntry[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toUpperCase());
  const dateIdx = header.findIndex(
    (h) => h === "DATE" || h === "DATUM" || h === "ASOF",
  );
  if (dateIdx < 0) return [];

  const currencyCols: { code: string; idx: number }[] = [];
  header.forEach((h, idx) => {
    if (idx === dateIdx) return;
    if ((CURRENCIES as readonly string[]).includes(h)) {
      currencyCols.push({ code: h, idx });
    }
  });

  const out: FxRateHistoryEntry[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(/[,;\t]/).map((c) => c.trim());
    const dateRaw = cells[dateIdx] ?? "";
    const date = dateRaw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const rates = defaultFxRatesForBase(baseCurrency);
    for (const col of currencyCols) {
      const n = Number(cells[col.idx]?.replace(",", "."));
      if (Number.isFinite(n) && n > 0) rates[col.code] = n;
    }
    rates[baseCurrency] = 1;
    out.push({
      id: createId("fxh"),
      date,
      rates,
      note: "CSV Import",
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function fxRatesCsvTemplate(baseCurrency: string): string {
  const cols = CURRENCIES.filter((c) => c !== baseCurrency);
  const header = ["date", ...cols].join(",");
  const defaults = defaultFxRatesForBase(baseCurrency);
  const today = new Date().toISOString().slice(0, 10);
  const row = [today, ...cols.map((c) => String(defaults[c] ?? 1))].join(",");
  return `${header}\n${row}\n`;
}

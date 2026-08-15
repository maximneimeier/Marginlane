import raw from "@/data/us_state_tax_rates.json";

export type UsStateRateType =
  | "flat"
  | "graduated"
  | "none"
  | "alternative_tax";

export type UsStateTaxRateRow = {
  state_code: string;
  state_name: string;
  rate_type: UsStateRateType;
  /** Planungswert: bei flat der Satz; bei graduated der obere Tarifsatz */
  rate_percent: number;
  /** Bei graduated z. B. "6.5–11.5", sonst null */
  rate_range: string | null;
};

type UsStateTaxRatesFile = {
  asOfYear: number;
  sourceNote: string;
  rates: UsStateTaxRateRow[];
};

const data = raw as UsStateTaxRatesFile;

const BY_CODE = new Map(
  data.rates.map((row) => [row.state_code.toUpperCase(), row] as const),
);

export function usStateTaxRatesAsOfYear(): number {
  return data.asOfYear;
}

export function listUsStateTaxRates(): UsStateTaxRateRow[] {
  return data.rates.slice();
}

export function getUsStateTaxRate(
  stateCode: string | null | undefined,
): UsStateTaxRateRow | null {
  if (!stateCode || typeof stateCode !== "string") return null;
  return BY_CODE.get(stateCode.trim().toUpperCase()) ?? null;
}

/** Keine klassische %-Körperschaftsteuer (none oder alternative_tax). */
export function isUsStateWithoutClassicCit(
  row: UsStateTaxRateRow | null | undefined,
): boolean {
  if (!row) return false;
  return row.rate_type === "none" || row.rate_type === "alternative_tax";
}

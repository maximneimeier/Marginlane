import type {
  AppData,
  CatalogProduct,
  Component,
  Dealer,
  DealerChannel,
  SalesPlanCell,
  SalesPlanRowMeta,
  SalesPlanScenario,
  SalesPlanSettings,
} from "./types";
import {
  EMPTY_SALES_PLAN_SETTINGS,
  SALES_PLAN_SCENARIOS,
} from "./types";
import { parseDateInput, type DateRange } from "./overview";

/** `null` = Direktverkauf / ohne Händler */
export type DealerRef = string | null;

export type SeasonProfileId = "even" | "h2_heavy" | "q4_peak" | "summer_peak";

/** Relative Monatsgewichte (werden normalisiert). */
export const SEASON_PROFILES: Record<SeasonProfileId, number[]> = {
  even: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  h2_heavy: [0.6, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.2, 1.3, 1.3, 1.3],
  q4_peak: [0.7, 0.7, 0.8, 0.8, 0.9, 0.9, 0.9, 1, 1.1, 1.4, 1.5, 1.6],
  summer_peak: [0.7, 0.7, 0.9, 1.1, 1.3, 1.4, 1.4, 1.3, 1, 0.8, 0.7, 0.7],
};

export const SEASON_PROFILE_IDS = Object.keys(
  SEASON_PROFILES,
) as SeasonProfileId[];

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function monthKeysForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => monthKey(year, i));
}

export function parseSalesMonthKey(
  month: string,
): { year: number; monthIndex: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

export function dealerKey(dealerId: DealerRef): string {
  return dealerId ?? "";
}

export function freezeKey(year: number, scenario: SalesPlanScenario): string {
  return `${year}:${scenario}`;
}

export function isPlanFrozen(
  settings: SalesPlanSettings | null | undefined,
  year: number,
  scenario: SalesPlanScenario,
): boolean {
  return (settings?.frozen ?? []).includes(freezeKey(year, scenario));
}

export function normalizeScenario(value: unknown): SalesPlanScenario {
  if (value === "upside" || value === "downside" || value === "base") {
    return value;
  }
  return "base";
}

export function cellMapKey(
  productId: string,
  dealerId: DealerRef,
  month: string,
  scenario: SalesPlanScenario,
): string {
  return `${productId}\0${dealerKey(dealerId)}\0${month}\0${scenario}`;
}

export function parseCellMapKey(key: string): {
  productId: string;
  dealerId: DealerRef;
  month: string;
  scenario: SalesPlanScenario;
} | null {
  const parts = key.split("\0");
  if (parts.length === 4) {
    const [productId, dKey, month, scenario] = parts;
    if (!productId || !month) return null;
    return {
      productId,
      dealerId: dKey ? dKey : null,
      month,
      scenario: normalizeScenario(scenario),
    };
  }
  // Legacy keys without scenario
  if (parts.length === 3) {
    const [productId, dKey, month] = parts;
    if (!productId || !month) return null;
    return {
      productId,
      dealerId: dKey ? dKey : null,
      month,
      scenario: "base",
    };
  }
  return null;
}

export function rowMetaKey(
  productId: string,
  dealerId: DealerRef,
  scenario: SalesPlanScenario,
): string {
  return `${productId}\0${dealerKey(dealerId)}\0${scenario}`;
}

export function normalizeSalesPlanCell(
  raw: Partial<SalesPlanCell> & Record<string, unknown>,
): SalesPlanCell | null {
  if (typeof raw.productId !== "string" || !raw.productId) return null;
  if (typeof raw.month !== "string" || !parseSalesMonthKey(raw.month)) {
    return null;
  }
  const quantity =
    typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
      ? Math.max(0, raw.quantity)
      : 0;
  if (quantity <= 0) return null;
  const dealerId =
    typeof raw.dealerId === "string" && raw.dealerId.trim()
      ? raw.dealerId.trim()
      : null;
  return {
    productId: raw.productId,
    dealerId,
    month: raw.month,
    quantity,
    scenario: normalizeScenario(raw.scenario),
  };
}

export function normalizeSalesPlanRowMeta(
  raw: Partial<SalesPlanRowMeta> & Record<string, unknown>,
): SalesPlanRowMeta | null {
  if (typeof raw.productId !== "string" || !raw.productId) return null;
  const dealerId =
    typeof raw.dealerId === "string" && raw.dealerId.trim()
      ? raw.dealerId.trim()
      : null;
  const unitPrice =
    typeof raw.unitPrice === "number" && Number.isFinite(raw.unitPrice)
      ? Math.max(0, raw.unitPrice)
      : null;
  const note = typeof raw.note === "string" ? raw.note : "";
  if (unitPrice == null && !note.trim()) return null;
  return {
    productId: raw.productId,
    dealerId,
    scenario: normalizeScenario(raw.scenario),
    unitPrice,
    note,
  };
}

export function normalizeSalesPlanSettings(
  raw: Partial<SalesPlanSettings> | null | undefined,
): SalesPlanSettings {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_SALES_PLAN_SETTINGS };
  }
  const frozen = Array.isArray(raw.frozen)
    ? raw.frozen.filter((k): k is string => typeof k === "string")
    : [];
  return {
    activeScenario: normalizeScenario(raw.activeScenario),
    frozen,
  };
}

export function salesPlanMap(cells: SalesPlanCell[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const cell of cells) {
    if (!(cell.quantity > 0)) continue;
    const key = cellMapKey(
      cell.productId,
      cell.dealerId ?? null,
      cell.month,
      cell.scenario ?? "base",
    );
    map.set(key, (map.get(key) ?? 0) + cell.quantity);
  }
  return map;
}

export function getSalesPlanQuantity(
  cells: SalesPlanCell[],
  productId: string,
  dealerId: DealerRef,
  month: string,
  scenario: SalesPlanScenario = "base",
): number {
  return (
    cells.find(
      (c) =>
        c.productId === productId &&
        (c.dealerId ?? null) === dealerId &&
        c.month === month &&
        (c.scenario ?? "base") === scenario,
    )?.quantity ?? 0
  );
}

export function yearTotalForRow(
  cells: SalesPlanCell[],
  productId: string,
  dealerId: DealerRef,
  year: number,
  scenario: SalesPlanScenario = "base",
): number {
  const keys = new Set(monthKeysForYear(year));
  return cells
    .filter(
      (c) =>
        c.productId === productId &&
        (c.dealerId ?? null) === dealerId &&
        (c.scenario ?? "base") === scenario &&
        keys.has(c.month),
    )
    .reduce((acc, c) => acc + c.quantity, 0);
}

export function yearTotalForProduct(
  cells: SalesPlanCell[],
  productId: string,
  year: number,
  scenario: SalesPlanScenario = "base",
): number {
  const keys = new Set(monthKeysForYear(year));
  return cells
    .filter(
      (c) =>
        c.productId === productId &&
        (c.scenario ?? "base") === scenario &&
        keys.has(c.month),
    )
    .reduce((acc, c) => acc + c.quantity, 0);
}

export function distributeAnnualEvenly(annualQuantity: number): number[] {
  return distributeAnnualByProfile(annualQuantity, "even");
}

export function distributeAnnualByProfile(
  annualQuantity: number,
  profileId: SeasonProfileId,
): number[] {
  const total = Math.max(0, Math.round(annualQuantity));
  if (total <= 0) return Array.from({ length: 12 }, () => 0);
  const weights = SEASON_PROFILES[profileId] ?? SEASON_PROFILES.even;
  const sumW = weights.reduce((a, b) => a + b, 0) || 12;
  const raw = weights.map((w) => (total * w) / sumW);
  const floored = raw.map((v) => Math.floor(v));
  let rem = total - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floored];
  for (const { i } of order) {
    if (rem <= 0) break;
    out[i]! += 1;
    rem -= 1;
  }
  return out;
}

export function applyGrowthPercent(
  quantities: number[],
  percent: number,
): number[] {
  const factor = 1 + percent / 100;
  return quantities.map((q) => Math.max(0, Math.round(q * factor)));
}

/**
 * Forecast: Monate &lt; asOfMonthIndex → Ist, Rest → Run-Rate aus YTD-Ist
 * (oder Plan, falls kein Ist).
 */
export function buildYtdForecastQuantities(
  actuals: number[],
  plan: number[],
  asOfMonthIndex: number,
): number[] {
  const ytdActual = actuals
    .slice(0, Math.max(0, asOfMonthIndex))
    .reduce((a, b) => a + b, 0);
  const monthsDone = Math.max(0, asOfMonthIndex);
  const runRate =
    monthsDone > 0
      ? ytdActual / monthsDone
      : plan.reduce((a, b) => a + b, 0) / 12;
  return Array.from({ length: 12 }, (_, i) => {
    if (i < asOfMonthIndex) return Math.max(0, Math.round(actuals[i] ?? 0));
    return Math.max(0, Math.round(runRate));
  });
}

export function planQuantitiesForYear(
  cells: SalesPlanCell[],
  productId: string,
  dealerId: DealerRef,
  year: number,
  scenario: SalesPlanScenario = "base",
): number[] {
  return monthKeysForYear(year).map((month) =>
    getSalesPlanQuantity(cells, productId, dealerId, month, scenario),
  );
}

export function mergeSalesPlan(
  existing: SalesPlanCell[],
  updates: SalesPlanCell[],
): SalesPlanCell[] {
  const map = salesPlanMap(existing);
  for (const cell of updates) {
    const scenario = cell.scenario ?? "base";
    const key = cellMapKey(
      cell.productId,
      cell.dealerId ?? null,
      cell.month,
      scenario,
    );
    if (cell.quantity > 0) map.set(key, cell.quantity);
    else map.delete(key);
  }
  const next: SalesPlanCell[] = [];
  for (const [key, quantity] of map) {
    const parsed = parseCellMapKey(key);
    if (!parsed) continue;
    next.push({
      productId: parsed.productId,
      dealerId: parsed.dealerId,
      month: parsed.month,
      quantity,
      scenario: parsed.scenario,
    });
  }
  return next.sort((a, b) => {
    const sa = a.scenario ?? "base";
    const sb = b.scenario ?? "base";
    if (sa !== sb) return sa.localeCompare(sb);
    if (a.productId !== b.productId) return a.productId.localeCompare(b.productId);
    const da = a.dealerId ?? "";
    const db = b.dealerId ?? "";
    if (da !== db) return da.localeCompare(db);
    return a.month.localeCompare(b.month);
  });
}

export function mergeSalesPlanRowMeta(
  existing: SalesPlanRowMeta[],
  updates: SalesPlanRowMeta[],
): SalesPlanRowMeta[] {
  const map = new Map<string, SalesPlanRowMeta>();
  for (const row of existing) {
    map.set(
      rowMetaKey(row.productId, row.dealerId ?? null, row.scenario ?? "base"),
      {
        ...row,
        scenario: row.scenario ?? "base",
        dealerId: row.dealerId ?? null,
        note: row.note ?? "",
      },
    );
  }
  for (const row of updates) {
    const scenario = row.scenario ?? "base";
    const key = rowMetaKey(row.productId, row.dealerId ?? null, scenario);
    const next: SalesPlanRowMeta = {
      productId: row.productId,
      dealerId: row.dealerId ?? null,
      scenario,
      unitPrice: row.unitPrice,
      note: row.note ?? "",
    };
    if (
      (next.unitPrice == null || !Number.isFinite(next.unitPrice)) &&
      !next.note.trim()
    ) {
      map.delete(key);
    } else {
      map.set(key, next);
    }
  }
  return [...map.values()].sort((a, b) =>
    rowMetaKey(a.productId, a.dealerId, a.scenario).localeCompare(
      rowMetaKey(b.productId, b.dealerId, b.scenario),
    ),
  );
}

export function getRowMeta(
  metas: SalesPlanRowMeta[],
  productId: string,
  dealerId: DealerRef,
  scenario: SalesPlanScenario,
): SalesPlanRowMeta | null {
  return (
    metas.find(
      (m) =>
        m.productId === productId &&
        (m.dealerId ?? null) === dealerId &&
        (m.scenario ?? "base") === scenario,
    ) ?? null
  );
}

export function cellsForRowYear(
  productId: string,
  dealerId: DealerRef,
  year: number,
  quantities: number[],
  scenario: SalesPlanScenario = "base",
): SalesPlanCell[] {
  const months = monthKeysForYear(year);
  return months.map((month, i) => ({
    productId,
    dealerId,
    month,
    quantity: Math.max(0, quantities[i] ?? 0),
    scenario,
  }));
}

export function cellsForProductYear(
  productId: string,
  year: number,
  quantities: number[],
  dealerId: DealerRef = null,
  scenario: SalesPlanScenario = "base",
): SalesPlanCell[] {
  return cellsForRowYear(productId, dealerId, year, quantities, scenario);
}

/**
 * Plan-VK: Row-Meta → Händler-Default → Listenpreis.
 */
export function resolvePlanUnitPrice(
  data: AppData,
  productId: string,
  dealerId: DealerRef,
  scenario: SalesPlanScenario,
): number {
  const meta = getRowMeta(
    data.salesPlanRowMeta ?? [],
    productId,
    dealerId,
    scenario,
  );
  if (meta?.unitPrice != null && Number.isFinite(meta.unitPrice)) {
    return Math.max(0, meta.unitPrice);
  }
  if (dealerId) {
    const dealer = data.dealers.find((d) => d.id === dealerId);
    if (dealer && Number.isFinite(dealer.defaultSellPrice)) {
      return Math.max(0, dealer.defaultSellPrice);
    }
  }
  const product = data.catalogProducts.find((p) => p.id === productId);
  if (product?.listPrice != null && Number.isFinite(product.listPrice)) {
    return Math.max(0, product.listPrice);
  }
  return 0;
}

export function plannedMarginPercent(
  unitPrice: number,
  unitCost: number,
): number | null {
  if (!(unitPrice > 0)) return null;
  return ((unitPrice - unitCost) / unitPrice) * 100;
}

export function actualQuantityByProductDealerMonth(
  data: AppData,
  year: number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const batch of data.batches) {
    const d = parseDateInput(batch.createdAt.slice(0, 10));
    if (!d || d.getFullYear() !== year) continue;
    const month = monthKey(year, d.getMonth());
    const sales = batch.sales ?? [];
    if (sales.length === 0) {
      const key = `${batch.productId}\0\0${month}`;
      map.set(key, (map.get(key) ?? 0) + Math.max(0, batch.quantity));
      continue;
    }
    for (const sale of sales) {
      const key = `${batch.productId}\0${dealerKey(sale.dealerId ?? null)}\0${month}`;
      map.set(key, (map.get(key) ?? 0) + Math.max(0, sale.quantity));
    }
  }
  return map;
}

function actualKey(
  productId: string,
  dealerId: DealerRef,
  month: string,
): string {
  return `${productId}\0${dealerKey(dealerId)}\0${month}`;
}

export function actualQuantitiesForRowYear(
  data: AppData,
  productId: string,
  dealerId: DealerRef,
  year: number,
): number[] {
  const map = actualQuantityByProductDealerMonth(data, year);
  return monthKeysForYear(year).map(
    (month) => map.get(actualKey(productId, dealerId, month)) ?? 0,
  );
}

export function actualYearTotalForRow(
  data: AppData,
  productId: string,
  dealerId: DealerRef,
  year: number,
): number {
  return actualQuantitiesForRowYear(data, productId, dealerId, year).reduce(
    (a, b) => a + b,
    0,
  );
}

export function actualYearTotalForProduct(
  data: AppData,
  productId: string,
  year: number,
): number {
  const map = actualQuantityByProductDealerMonth(data, year);
  let sum = 0;
  for (const [key, qty] of map) {
    if (key.startsWith(`${productId}\0`)) sum += qty;
  }
  return sum;
}

export function dealerIdsForProductYear(
  data: AppData,
  productId: string,
  year: number,
  scenario: SalesPlanScenario = "base",
): DealerRef[] {
  const set = new Set<string>();
  const yearMonths = new Set(monthKeysForYear(year));
  const priorMonths = new Set(monthKeysForYear(year - 1));

  for (const cell of data.salesPlan ?? []) {
    if (cell.productId !== productId) continue;
    if ((cell.scenario ?? "base") !== scenario) continue;
    if (!yearMonths.has(cell.month) && !priorMonths.has(cell.month)) continue;
    set.add(dealerKey(cell.dealerId ?? null));
  }

  for (const meta of data.salesPlanRowMeta ?? []) {
    if (meta.productId !== productId) continue;
    if ((meta.scenario ?? "base") !== scenario) continue;
    set.add(dealerKey(meta.dealerId ?? null));
  }

  const actual = actualQuantityByProductDealerMonth(data, year);
  const actualPrior = actualQuantityByProductDealerMonth(data, year - 1);
  for (const map of [actual, actualPrior]) {
    for (const key of map.keys()) {
      const [pid, dKey = ""] = key.split("\0");
      if (pid !== productId) continue;
      set.add(dKey);
    }
  }

  const refs: DealerRef[] = [...set].map((k) => (k ? k : null));
  return refs.sort((a, b) => {
    if (a === null) return -1;
    if (b === null) return 1;
    return a.localeCompare(b);
  });
}

export function scrubDealerFromSalesPlan(
  cells: SalesPlanCell[],
  dealerId: string,
): SalesPlanCell[] {
  const moved = cells
    .filter((c) => c.dealerId === dealerId)
    .map((c) => ({ ...c, dealerId: null }));
  const rest = cells.filter((c) => c.dealerId !== dealerId);
  return mergeSalesPlan(rest, moved);
}

export function scrubDealerFromRowMeta(
  metas: SalesPlanRowMeta[],
  dealerId: string,
): SalesPlanRowMeta[] {
  const moved = metas
    .filter((m) => m.dealerId === dealerId)
    .map((m) => ({ ...m, dealerId: null }));
  const rest = metas.filter((m) => m.dealerId !== dealerId);
  return mergeSalesPlanRowMeta(rest, moved);
}

export function filterDealersByChannel(
  dealers: AppData["dealers"],
  channel: DealerChannel | "all",
): AppData["dealers"] {
  if (channel === "all") return dealers;
  return dealers.filter((d) => d.channel === channel);
}

export function monthsInDateRange(range: DateRange): string[] {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  if (!from || !to || to < from) return [];
  const keys: string[] = [];
  let y = from.getFullYear();
  let m = from.getMonth();
  const endY = to.getFullYear();
  const endM = to.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(monthKey(y, m));
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    if (keys.length > 120) break;
  }
  return keys;
}

export function actualQuantitiesForProductYear(
  data: AppData,
  productId: string,
  year: number,
): number[] {
  const map = actualQuantityByProductDealerMonth(data, year);
  return monthKeysForYear(year).map((month) => {
    let sum = 0;
    for (const [key, qty] of map) {
      const [pid, , m] = key.split("\0");
      if (pid === productId && m === month) sum += qty;
    }
    return sum;
  });
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvEscape).join(";");
}

export function buildSalesPlanCsv(
  data: AppData,
  year: number,
  scenario: SalesPlanScenario,
): string {
  const months = monthKeysForYear(year);
  const lines: string[] = [];
  lines.push(
    csvRow([
      "scenario",
      "productId",
      "productName",
      "dealerId",
      "dealerName",
      "unitPrice",
      "note",
      ...months,
      "yearTotal",
    ]),
  );

  const products = [...data.catalogProducts].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const product of products) {
    const dealerIds = dealerIdsForProductYear(data, product.id, year, scenario);
    const ids = dealerIds.length > 0 ? dealerIds : [null];
    for (const dealerId of ids) {
      const dealer = dealerId
        ? data.dealers.find((d) => d.id === dealerId)
        : null;
      const meta = getRowMeta(
        data.salesPlanRowMeta ?? [],
        product.id,
        dealerId,
        scenario,
      );
      const qtys = planQuantitiesForYear(
        data.salesPlan ?? [],
        product.id,
        dealerId,
        year,
        scenario,
      );
      const total = qtys.reduce((a, b) => a + b, 0);
      if (total <= 0 && !meta) continue;
      lines.push(
        csvRow([
          scenario,
          product.id,
          product.name,
          dealerId,
          dealer?.name ?? "",
          meta?.unitPrice ?? resolvePlanUnitPrice(data, product.id, dealerId, scenario),
          meta?.note ?? "",
          ...qtys,
          total,
        ]),
      );
    }
  }
  return lines.join("\n");
}

export function downloadSalesPlanCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type SalesPlanImportResult = {
  cells: SalesPlanCell[];
  rowMeta: SalesPlanRowMeta[];
  errors: string[];
};

/**
 * CSV-Import (Semikolon). Erwartet Header mit scenario, productId, dealerId,
 * optional unitPrice/note und Monats-Spalten YYYY-MM oder Jan–Dez-Indizes.
 */
export function parseSalesPlanCsv(
  text: string,
  year: number,
  fallbackScenario: SalesPlanScenario,
): SalesPlanImportResult {
  const errors: string[] = [];
  const cells: SalesPlanCell[] = [];
  const rowMeta: SalesPlanRowMeta[] = [];
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return { cells, rowMeta, errors: ["Leere Datei"] };

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { cells, rowMeta, errors: ["Keine Datenzeilen"] };
  }

  const header = splitCsvLine(lines[0]!);
  const idx = (name: string) =>
    header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());

  const iScenario = idx("scenario");
  const iProduct = idx("productId");
  const iDealer = idx("dealerId");
  const iPrice = idx("unitPrice");
  const iNote = idx("note");
  if (iProduct < 0) {
    return { cells, rowMeta, errors: ["Spalte productId fehlt"] };
  }

  const monthCols: Array<{ month: string; col: number }> = [];
  const yearMonths = monthKeysForYear(year);
  header.forEach((h, col) => {
    const t = h.trim();
    if (parseSalesMonthKey(t)) {
      monthCols.push({ month: t, col });
      return;
    }
    const mi = yearMonths.indexOf(t);
    if (mi >= 0) monthCols.push({ month: yearMonths[mi]!, col });
  });
  // Fallback: 12 numeric columns after known fields
  if (monthCols.length === 0) {
    yearMonths.forEach((month, i) => {
      const col = Math.max(iDealer, iProduct, iScenario, iPrice, iNote) + 1 + i;
      if (col < header.length) monthCols.push({ month, col });
    });
  }

  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li]!);
    const productId = cols[iProduct]?.trim();
    if (!productId) {
      errors.push(`Zeile ${li + 1}: productId fehlt`);
      continue;
    }
    const scenario = normalizeScenario(
      iScenario >= 0 ? cols[iScenario] : fallbackScenario,
    );
    const dealerRaw = iDealer >= 0 ? cols[iDealer]?.trim() : "";
    const dealerId = dealerRaw ? dealerRaw : null;
    const unitPriceRaw = iPrice >= 0 ? cols[iPrice]?.trim() : "";
    const note = iNote >= 0 ? (cols[iNote] ?? "").trim() : "";
    const unitPrice =
      unitPriceRaw && Number.isFinite(Number(unitPriceRaw.replace(",", ".")))
        ? Number(unitPriceRaw.replace(",", "."))
        : null;
    if (unitPrice != null || note) {
      rowMeta.push({
        productId,
        dealerId,
        scenario,
        unitPrice,
        note,
      });
    }
    for (const { month, col } of monthCols) {
      const rawQty = cols[col]?.trim() ?? "";
      if (!rawQty) continue;
      const qty = Number(rawQty.replace(",", "."));
      if (!Number.isFinite(qty) || qty <= 0) continue;
      cells.push({
        productId,
        dealerId,
        month,
        quantity: qty,
        scenario,
      });
    }
  }

  return { cells, rowMeta, errors };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ";") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export type PlannedVolumeSummary = {
  quantity: number;
  revenue: number;
  actualQuantity: number;
  productCount: number;
};

export function summarizePlannedVolume(
  data: AppData,
  range: DateRange,
  scenario?: SalesPlanScenario,
): PlannedVolumeSummary {
  const sc =
    scenario ??
    data.salesPlanSettings?.activeScenario ??
    "base";
  const months = monthsInDateRange(range);
  const monthSet = new Set(months);
  let quantity = 0;
  let revenue = 0;
  const products = new Set<string>();

  for (const cell of data.salesPlan ?? []) {
    if ((cell.scenario ?? "base") !== sc) continue;
    if (!monthSet.has(cell.month) || !(cell.quantity > 0)) continue;
    products.add(cell.productId);
    quantity += cell.quantity;
    const price = resolvePlanUnitPrice(
      data,
      cell.productId,
      cell.dealerId ?? null,
      sc,
    );
    revenue += price * cell.quantity;
  }

  let actualQuantity = 0;
  const years = new Set(
    months.map((m) => Number(m.slice(0, 4))).filter(Number.isFinite),
  );
  for (const year of years) {
    const map = actualQuantityByProductDealerMonth(data, year);
    for (const [key, qty] of map) {
      const parts = key.split("\0");
      const month = parts[2];
      if (month && monthSet.has(month)) actualQuantity += qty;
    }
  }

  return {
    quantity,
    revenue,
    actualQuantity,
    productCount: products.size,
  };
}

export function rowUnitCost(
  productId: string,
  components: Component[],
): number {
  return components
    .filter((c) => c.productId === productId)
    .reduce(
      (sum, c) =>
        sum + c.purchasePricePerUnit * Math.max(c.quantityPerProductUnit, 0),
      0,
    );
}

export function ensureScenarioOnCells(
  cells: SalesPlanCell[],
): SalesPlanCell[] {
  return cells.map((c) => ({
    ...c,
    scenario: normalizeScenario(c.scenario),
    dealerId: c.dealerId ?? null,
  }));
}

export { SALES_PLAN_SCENARIOS };

export type { CatalogProduct, Dealer, SalesPlanSettings };

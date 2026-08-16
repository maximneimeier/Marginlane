import type {
  AppData,
  CatalogProduct,
  Component,
  Supplier,
} from "./types";
import { createId } from "./format";
import { emptyComponent } from "./migrateAppData";

export type ImportResult = {
  suppliersUpserted: number;
  productsUpserted: number;
  componentsUpserted: number;
  errors: string[];
};

function parseDelimited(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const delim = lines[0].includes(";") ? ";" : ",";
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  });
}

function headerMap(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((h, i) => map.set(h.trim().toLowerCase(), i));
  return map;
}

function cell(row: string[], map: Map<string, number>, key: string): string {
  const idx = map.get(key.toLowerCase());
  if (idx == null) return "";
  return row[idx] ?? "";
}

function num(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Import Lieferanten-CSV (Export-kompatibel). Upsert per id, sonst Name. */
export function importSuppliersCsv(
  csv: string,
  data: AppData,
): { data: AppData; upserted: number; errors: string[] } {
  const rows = parseDelimited(csv);
  const errors: string[] = [];
  if (rows.length < 2) {
    return { data, upserted: 0, errors: ["empty"] };
  }
  const map = headerMap(rows[0]);
  if (!map.has("name")) {
    return { data, upserted: 0, errors: ["missing_name"] };
  }
  const suppliers = [...data.suppliers];
  let upserted = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = cell(r, map, "name");
    if (!name) {
      errors.push(`row_${i + 1}_no_name`);
      continue;
    }
    const id = cell(r, map, "id") || createId("sup");
    const existing = suppliers.findIndex(
      (s) => s.id === id || s.name.toLowerCase() === name.toLowerCase(),
    );
    const base: Supplier =
      existing >= 0
        ? suppliers[existing]
        : {
            id,
            name,
            country: "",
            contactName: "",
            email: "",
            phone: "",
            currency: "EUR",
            paymentDays: 30,
            paymentUnit: "Tage",
            skontoPercent: 0,
            skontoDays: 0,
            incoterm: "FOB",
            taxId: "",
            legalForm: "",
            website: "",
            originPort: "",
            leadTimeDays: 0,
            iban: "",
            certifications: "",
            status: "active",
            notes: "",
            paymentTerms: "",
            createdAt: new Date().toISOString(),
          };
    const next: Supplier = {
      ...base,
      id: existing >= 0 ? base.id : id,
      name,
      country: cell(r, map, "country") || base.country,
      contactName: cell(r, map, "contactName") || base.contactName,
      email: cell(r, map, "email") || base.email,
      currency: cell(r, map, "currency") || base.currency,
      paymentDays: num(cell(r, map, "paymentDays")) ?? base.paymentDays,
      paymentUnit:
        (cell(r, map, "paymentUnit") as Supplier["paymentUnit"]) ||
        base.paymentUnit,
      incoterm: cell(r, map, "incoterm") || base.incoterm,
      status:
        cell(r, map, "status") === "inactive" ? "inactive" : "active",
      notes: cell(r, map, "notes") || base.notes,
    };
    if (existing >= 0) suppliers[existing] = next;
    else suppliers.push(next);
    upserted++;
  }
  return { data: { ...data, suppliers }, upserted, errors };
}

/** Import Produkte-CSV. Upsert per id oder sku. */
export function importProductsCsv(
  csv: string,
  data: AppData,
): { data: AppData; upserted: number; errors: string[] } {
  const rows = parseDelimited(csv);
  const errors: string[] = [];
  if (rows.length < 2) {
    return { data, upserted: 0, errors: ["empty"] };
  }
  const map = headerMap(rows[0]);
  if (!map.has("name")) {
    return { data, upserted: 0, errors: ["missing_name"] };
  }
  const catalogProducts = [...data.catalogProducts];
  let upserted = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = cell(r, map, "name");
    if (!name) {
      errors.push(`row_${i + 1}_no_name`);
      continue;
    }
    const sku = cell(r, map, "sku");
    const id = cell(r, map, "id") || createId("cat");
    const existing = catalogProducts.findIndex(
      (p) =>
        p.id === id ||
        (sku && p.sku && p.sku.toLowerCase() === sku.toLowerCase()),
    );
    const base: CatalogProduct =
      existing >= 0
        ? catalogProducts[existing]
        : {
            id,
            name,
            sku: sku || "",
            listPrice: null,
            pricingUnit: "pcs",
            currency: "EUR",
            status: "active",
            category: "",
            targetMarginPercent: null,
            hsCode: "",
            countryOfOrigin: "",
            dutyRatePercent: 0,
            notes: "",
            documents: [],
            createdAt: new Date().toISOString(),
          };
    const listPrice = num(cell(r, map, "listPrice"));
    const targetMargin = num(cell(r, map, "targetMarginPercent"));
    const dutyRate = num(cell(r, map, "dutyRatePercent"));
    const next: CatalogProduct = {
      ...base,
      id: existing >= 0 ? base.id : id,
      name,
      sku: sku || base.sku,
      listPrice: listPrice ?? base.listPrice,
      pricingUnit:
        (cell(r, map, "pricingUnit") as CatalogProduct["pricingUnit"]) ||
        base.pricingUnit,
      currency: cell(r, map, "currency") || base.currency,
      status: cell(r, map, "status") === "inactive" ? "inactive" : "active",
      category: cell(r, map, "category") || base.category,
      targetMarginPercent: targetMargin ?? base.targetMarginPercent,
      hsCode: cell(r, map, "hsCode") || base.hsCode,
      countryOfOrigin:
        cell(r, map, "countryOfOrigin") || base.countryOfOrigin,
      dutyRatePercent: dutyRate ?? base.dutyRatePercent,
      notes: cell(r, map, "notes") || base.notes,
    };
    if (existing >= 0) catalogProducts[existing] = next;
    else catalogProducts.push(next);
    upserted++;
  }
  return { data: { ...data, catalogProducts }, upserted, errors };
}

/** Import Komponenten-Stamm (ohne BOM-Links wenn productId fehlt). */
export function importComponentsCsv(
  csv: string,
  data: AppData,
): { data: AppData; upserted: number; errors: string[] } {
  const rows = parseDelimited(csv);
  const errors: string[] = [];
  if (rows.length < 2) {
    return { data, upserted: 0, errors: ["empty"] };
  }
  const map = headerMap(rows[0]);
  const nameKey = map.has("name")
    ? "name"
    : map.has("componentname")
      ? "componentname"
      : null;
  if (!nameKey && !map.has("componentid")) {
    return { data, upserted: 0, errors: ["missing_name"] };
  }
  const components = [...data.components];
  let upserted = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = cell(r, map, "componentId") || cell(r, map, "id") || createId("cmp");
    const name = nameKey ? cell(r, map, nameKey) : "";
    if (!name && !cell(r, map, "componentId")) {
      errors.push(`row_${i + 1}_no_name`);
      continue;
    }
    const existing = components.findIndex((c) => c.id === id);
    const base: Component =
      existing >= 0 ? components[existing] : emptyComponent();
    const price = num(cell(r, map, "purchasePricePerUnit"));
    const dutyRate = num(cell(r, map, "dutyRatePercent"));
    const next: Component = {
      ...base,
      id: existing >= 0 ? base.id : id,
      name: name || base.name,
      sku: cell(r, map, "sku") || base.sku,
      supplierId: cell(r, map, "supplierId") || base.supplierId,
      currency: cell(r, map, "currency") || base.currency,
      purchasePricePerUnit: price ?? base.purchasePricePerUnit,
      hsCode: cell(r, map, "hsCode") || base.hsCode,
      countryOfOrigin:
        cell(r, map, "countryOfOrigin") || base.countryOfOrigin,
      dutyRatePercent: dutyRate ?? base.dutyRatePercent,
      notes: cell(r, map, "notes") || base.notes,
    };
    if (existing >= 0) components[existing] = next;
    else components.push(next);
    upserted++;
  }
  return { data: { ...data, components }, upserted, errors };
}

import type { AppData } from "./types";
import { calculateResolvedEconomics } from "./resolve";
import { resolveComponentCurrency } from "./resolve";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[;"\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvEscape).join(";");
}

/** UTF-8 BOM für Excel — Client hängt BOM beim Download an. */
export function downloadCsv(filename: string, csv: string) {
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

export function buildSuppliersCsv(data: AppData): string {
  const lines = [
    row([
      "id",
      "name",
      "country",
      "contactName",
      "email",
      "currency",
      "paymentDays",
      "paymentUnit",
      "incoterm",
      "status",
      "notes",
    ]),
  ];
  for (const s of data.suppliers) {
    lines.push(
      row([
        s.id,
        s.name,
        s.country,
        s.contactName,
        s.email,
        s.currency,
        s.paymentDays,
        s.paymentUnit,
        s.incoterm,
        s.status,
        s.notes,
      ]),
    );
  }
  return lines.join("\r\n");
}

export function buildProductsCsv(data: AppData): string {
  const lines = [
    row([
      "id",
      "name",
      "sku",
      "listPrice",
      "pricingUnit",
      "currency",
      "status",
      "category",
      "targetMarginPercent",
      "notes",
    ]),
  ];
  for (const p of data.catalogProducts) {
    lines.push(
      row([
        p.id,
        p.name,
        p.sku,
        p.listPrice,
        p.pricingUnit,
        p.currency,
        p.status,
        p.category,
        p.targetMarginPercent,
        p.notes,
      ]),
    );
  }
  return lines.join("\r\n");
}

export function buildComponentsCsv(data: AppData): string {
  const lines = [
    row([
      "componentId",
      "name",
      "sku",
      "linkId",
      "productId",
      "productName",
      "productSku",
      "supplierId",
      "supplierName",
      "currency",
      "currencySource",
      "purchasePricePerUnit",
      "purchasePriceOverride",
      "quantityPerProductUnit",
      "notes",
    ]),
  ];
  const links = data.productComponents ?? [];
  if (links.length === 0) {
    for (const c of data.components) {
      const supplier = data.suppliers.find((s) => s.id === c.supplierId);
      const currency = resolveComponentCurrency(c, supplier);
      lines.push(
        row([
          c.id,
          c.name,
          c.sku,
          "",
          "",
          "",
          "",
          c.supplierId,
          supplier?.name ?? "",
          currency.value,
          currency.source,
          c.purchasePricePerUnit,
          "",
          "",
          c.notes,
        ]),
      );
    }
  } else {
    for (const pc of links) {
      const c = data.components.find((x) => x.id === pc.componentId);
      if (!c) continue;
      const product = data.catalogProducts.find((p) => p.id === pc.productId);
      const supplier = data.suppliers.find((s) => s.id === c.supplierId);
      const currency = resolveComponentCurrency(c, supplier);
      lines.push(
        row([
          c.id,
          c.name,
          c.sku,
          pc.id,
          pc.productId,
          product?.name ?? "",
          product?.sku ?? "",
          c.supplierId,
          supplier?.name ?? "",
          currency.value,
          currency.source,
          c.purchasePricePerUnit,
          pc.purchasePriceOverride,
          pc.quantityPerProductUnit,
          c.notes,
        ]),
      );
    }
  }
  return lines.join("\r\n");
}

export function buildBatchesCsv(data: AppData): string {
  const lines = [
    row([
      "id",
      "label",
      "productId",
      "productName",
      "productSku",
      "supplierId",
      "supplierName",
      "quantity",
      "unitPurchasePrice",
      "landedCostPerUnit",
      "sellPrice",
      "contributionPerUnit",
      "contributionPercent",
      "createdAt",
    ]),
  ];
  for (const batch of data.batches) {
    const product = data.catalogProducts.find((p) => p.id === batch.productId);
    const supplier = data.suppliers.find((s) => s.id === batch.supplierId);
    const eco = calculateResolvedEconomics(data, batch);
    lines.push(
      row([
        batch.id,
        batch.label,
        batch.productId,
        product?.name ?? "",
        product?.sku ?? "",
        batch.supplierId,
        supplier?.name ?? "",
        batch.quantity,
        eco.unitPurchasePrice,
        round4(eco.landedCostPerUnit),
        round4(eco.sellPrice),
        round4(eco.contributionPerUnit),
        round4(eco.contributionPercent),
        batch.createdAt,
      ]),
    );
  }
  return lines.join("\r\n");
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

import type { AppData } from "./types";
import { migrateAppData } from "./migrateAppData";

export type ValidationIssue = {
  path: string;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonNegNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/**
 * Serverseitige Prüfung der Workspace-Payload.
 * Wirft keine Exception — liefert Issues; leeres Array = ok.
 */
export function validateAppData(raw: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return [{ path: "", message: "Payload must be an AppData object" }];
  }

  const data = migrateAppData(raw);

  for (const s of data.suppliers) {
    const base = `suppliers[${s.id}]`;
    if (!s.name.trim()) {
      issues.push({ path: `${base}.name`, message: "Supplier name is required" });
    }
    if (!s.country.trim()) {
      issues.push({
        path: `${base}.country`,
        message: "Supplier country is required",
      });
    }
    if (!s.contactName.trim()) {
      issues.push({
        path: `${base}.contactName`,
        message: "Supplier contact is required",
      });
    }
    if (!s.email.trim()) {
      issues.push({
        path: `${base}.email`,
        message: "Supplier email is required",
      });
    } else if (!EMAIL_RE.test(s.email.trim())) {
      issues.push({
        path: `${base}.email`,
        message: "Supplier email is invalid",
      });
    }
    if (!s.currency.trim()) {
      issues.push({
        path: `${base}.currency`,
        message: "Supplier currency is required",
      });
    }
    if (!s.paymentDays || s.paymentDays <= 0) {
      issues.push({
        path: `${base}.paymentDays`,
        message: "Supplier payment terms must be a positive number",
      });
    }
    if (!s.incoterm.trim()) {
      issues.push({
        path: `${base}.incoterm`,
        message: "Supplier Incoterm is required",
      });
    }
  }

  const skuSeen = new Map<string, string>();
  for (const p of data.catalogProducts) {
    const base = `catalogProducts[${p.id}]`;
    if (!p.name.trim()) {
      issues.push({
        path: `${base}.name`,
        message: "Product name is required",
      });
    }
    if (!p.sku.trim()) {
      issues.push({
        path: `${base}.sku`,
        message: "Product SKU is required",
      });
    } else {
      const key = p.sku.trim().toLowerCase();
      const prev = skuSeen.get(key);
      if (prev) {
        issues.push({
          path: `${base}.sku`,
          message: `Duplicate product SKU "${p.sku.trim()}" (also on ${prev})`,
        });
      } else {
        skuSeen.set(key, p.id);
      }
    }
    if (p.listPrice != null && !isNonNegNumber(p.listPrice)) {
      issues.push({
        path: `${base}.listPrice`,
        message: "Product list price must be ≥ 0",
      });
    }
  }

  const productIds = new Set(data.catalogProducts.map((p) => p.id));
  const componentIds = new Set(data.components.map((c) => c.id));

  for (const c of data.components) {
    const base = `components[${c.id}]`;
    if (!c.name.trim()) {
      issues.push({
        path: `${base}.name`,
        message: "Component name is required",
      });
    }
    if (!isNonNegNumber(c.purchasePricePerUnit)) {
      issues.push({
        path: `${base}.purchasePricePerUnit`,
        message: "Component purchase price must be ≥ 0",
      });
    }
  }

  for (const pc of data.productComponents ?? []) {
    const base = `productComponents[${pc.id}]`;
    if (!pc.productId || !productIds.has(pc.productId)) {
      issues.push({
        path: `${base}.productId`,
        message: "BOM link must reference an existing product",
      });
    }
    if (!pc.componentId || !componentIds.has(pc.componentId)) {
      issues.push({
        path: `${base}.componentId`,
        message: "BOM link must reference an existing component",
      });
    }
    if (!isNonNegNumber(pc.quantityPerProductUnit)) {
      issues.push({
        path: `${base}.quantityPerProductUnit`,
        message: "BOM quantity must be ≥ 0",
      });
    }
    if (
      pc.purchasePriceOverride != null &&
      !isNonNegNumber(pc.purchasePriceOverride)
    ) {
      issues.push({
        path: `${base}.purchasePriceOverride`,
        message: "BOM price override must be ≥ 0",
      });
    }
  }

  for (const d of data.dealers) {
    const base = `dealers[${d.id}]`;
    if (!d.name.trim()) {
      issues.push({
        path: `${base}.name`,
        message: "Dealer name is required",
      });
    }
    if (d.defaultSellPrice != null && !isNonNegNumber(d.defaultSellPrice)) {
      issues.push({
        path: `${base}.defaultSellPrice`,
        message: "Dealer default sell price must be ≥ 0",
      });
    }
    for (const item of d.salesCostItems ?? []) {
      if (!isNonNegNumber(item.amount)) {
        issues.push({
          path: `${base}.salesCostItems[${item.id}].amount`,
          message: "Cost item amount must be ≥ 0",
        });
      }
    }
  }

  for (const b of data.batches) {
    const base = `batches[${b.id}]`;
    if (!b.productId || !productIds.has(b.productId)) {
      issues.push({
        path: `${base}.productId`,
        message: "Batch must reference an existing product",
      });
    }
    if (!isNonNegNumber(b.quantity)) {
      issues.push({
        path: `${base}.quantity`,
        message: "Batch quantity must be ≥ 0",
      });
    }
    if (
      b.unitPurchasePrice != null &&
      !isNonNegNumber(b.unitPurchasePrice)
    ) {
      issues.push({
        path: `${base}.unitPurchasePrice`,
        message: "Batch purchase price must be ≥ 0",
      });
    }
    for (const item of b.costItems ?? []) {
      if (!isNonNegNumber(item.amount)) {
        issues.push({
          path: `${base}.costItems[${item.id}].amount`,
          message: "Cost item amount must be ≥ 0",
        });
      }
    }
    for (const sale of b.sales ?? []) {
      if (!isNonNegNumber(sale.quantity)) {
        issues.push({
          path: `${base}.sales[${sale.id}].quantity`,
          message: "Sale quantity must be ≥ 0",
        });
      }
      if (
        sale.salePricePerUnit != null &&
        !isNonNegNumber(sale.salePricePerUnit)
      ) {
        issues.push({
          path: `${base}.sales[${sale.id}].salePricePerUnit`,
          message: "Sale price must be ≥ 0",
        });
      }
      for (const item of sale.costItems ?? []) {
        if (!isNonNegNumber(item.amount)) {
          issues.push({
            path: `${base}.sales[${sale.id}].costItems[${item.id}].amount`,
            message: "Cost item amount must be ≥ 0",
          });
        }
      }
    }
  }

  return issues;
}

/** Normalisiert + validiert. Bei Fehlern: `{ ok: false, issues }`. */
export function parseAndValidateAppData(
  raw: unknown,
):
  | { ok: true; data: AppData }
  | { ok: false; issues: ValidationIssue[] } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      issues: [{ path: "", message: "Payload must be an AppData object" }],
    };
  }
  const data = migrateAppData(raw);
  const issues = validateAppData(data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, data };
}

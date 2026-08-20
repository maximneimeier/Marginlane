import type { AppData, ProductSupplier, Supplier } from "./types";
import { catalogProductUnitPurchaseCost } from "./migrateAppData";

/** Lieferanten-IDs aus BOM-Komponenten eines Produkts. */
export function bomSupplierIdsForProduct(
  data: AppData,
  productId: string,
): string[] {
  const componentIds = new Set(
    (data.productComponents ?? [])
      .filter((pc) => pc.productId === productId)
      .map((pc) => pc.componentId),
  );
  const ids = new Set<string>();
  for (const c of data.components) {
    if (!componentIds.has(c.id)) continue;
    if (c.supplierId) ids.add(c.supplierId);
  }
  return [...ids];
}

/** Explizite ProductSupplier-Links für ein Produkt. */
export function linkedSupplierIdsForProduct(
  data: AppData,
  productId: string,
): string[] {
  return (data.productSuppliers ?? [])
    .filter((ps) => ps.productId === productId && ps.supplierId)
    .map((ps) => ps.supplierId);
}

/**
 * Alle Lieferanten, die dieses Produkt liefern können
 * (explizite Links ∪ BOM-Komponenten).
 */
export function supplierIdsForProduct(
  data: AppData,
  productId: string,
): string[] {
  if (!productId) return [];
  return [
    ...new Set([
      ...linkedSupplierIdsForProduct(data, productId),
      ...bomSupplierIdsForProduct(data, productId),
    ]),
  ];
}

export function suppliersForProduct(
  data: AppData,
  productId: string,
): Supplier[] {
  const ids = new Set(supplierIdsForProduct(data, productId));
  return data.suppliers
    .filter((s) => ids.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Produkte, die ein Lieferant liefern kann. */
export function productIdsForSupplier(
  data: AppData,
  supplierId: string,
): string[] {
  if (!supplierId) return [];
  const fromLinks = (data.productSuppliers ?? [])
    .filter((ps) => ps.supplierId === supplierId)
    .map((ps) => ps.productId);
  const componentIds = new Set(
    data.components
      .filter((c) => c.supplierId === supplierId)
      .map((c) => c.id),
  );
  const fromBom = (data.productComponents ?? [])
    .filter((pc) => componentIds.has(pc.componentId))
    .map((pc) => pc.productId);
  return [...new Set([...fromLinks, ...fromBom])];
}

export function findProductSupplier(
  data: AppData,
  productId: string,
  supplierId: string,
): ProductSupplier | undefined {
  return (data.productSuppliers ?? []).find(
    (ps) => ps.productId === productId && ps.supplierId === supplierId,
  );
}

/**
 * EK/Einheit für Produkt × Lieferant:
 * 1) ProductSupplier.unitPurchasePrice
 * 2) BOM nur Komponenten dieses Lieferanten
 * 3) Gesamt-BOM
 */
export function unitPurchaseForProductSupplier(
  data: AppData,
  productId: string,
  supplierId: string,
  productQuantity = 1,
): number {
  const link = findProductSupplier(data, productId, supplierId);
  if (link?.unitPurchasePrice != null && link.unitPurchasePrice > 0) {
    return link.unitPurchasePrice;
  }

  const componentIds = new Set(
    (data.productComponents ?? [])
      .filter((pc) => pc.productId === productId)
      .map((pc) => pc.componentId),
  );
  const supplierComponentIds = new Set(
    data.components
      .filter((c) => componentIds.has(c.id) && c.supplierId === supplierId)
      .map((c) => c.id),
  );

  if (supplierComponentIds.size > 0) {
    return catalogProductUnitPurchaseCost(
      productId,
      data.components.filter((c) => supplierComponentIds.has(c.id)),
      (data.productComponents ?? []).filter((pc) =>
        supplierComponentIds.has(pc.componentId),
      ),
      productQuantity,
    );
  }

  return catalogProductUnitPurchaseCost(
    productId,
    data.components,
    data.productComponents ?? [],
    productQuantity,
  );
}

/** Bevorzugten Lieferanten für Dropdown-Vorauswahl. */
export function preferredSupplierIdForProduct(
  data: AppData,
  productId: string,
): string {
  const preferred = (data.productSuppliers ?? []).find(
    (ps) => ps.productId === productId && ps.preferred && ps.supplierId,
  );
  if (preferred) return preferred.supplierId;
  const ids = supplierIdsForProduct(data, productId);
  return ids[0] ?? "";
}

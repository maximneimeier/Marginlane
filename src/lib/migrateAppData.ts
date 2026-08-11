import {
  cellsForProductYear,
  mergeSalesPlan,
  mergeSalesPlanRowMeta,
  monthKeysForYear,
  normalizeSalesPlanCell,
  normalizeSalesPlanRowMeta,
  normalizeSalesPlanSettings,
} from "./salesPlan";
import type {
  AppData,
  Batch,
  CatalogProduct,
  Component,
  CostItem,
  OverheadActual,
  Product,
  Sale,
  SalesData,
  SalesPlanCell,
  SalesPlanRowMeta,
} from "./types";
import {
  EMPTY_DATA,
  migrateOverheadCategory,
  migrateOverheadCostBehavior,
  migrateOverheadVariableBasis,
} from "./types";
import { createId } from "./format";

type RawAppData = Partial<AppData> & {
  products?: Product[];
  catalogProducts?: Array<
    Partial<CatalogProduct> & { sellPrice?: number; listPrice?: number | null }
  >;
  components?: Component[];
  batches?: Array<
    Omit<Batch, "sales"> & {
      sales?: SalesData | Sale[] | null;
    }
  >;
};

function isSaleArray(value: unknown): value is Sale[] {
  return Array.isArray(value);
}

function isLegacySalesData(value: unknown): value is SalesData {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function legacySalesToSale(sales: SalesData, fallbackQty: number): Sale {
  return {
    id: createId("sale"),
    dealerId: sales.dealerId ?? null,
    salePricePerUnit: sales.sellPrice,
    quantity: sales.quantity || fallbackQty,
    channel: sales.channel || "",
    costItems: sales.costItems ?? null,
  };
}

/**
 * Migriert ältere AppData-Shapes auf das aktuelle Modell:
 * - CatalogProduct.sellPrice → listPrice
 * - Product (alte Komponenten) → Component (+ ggf. CatalogProduct)
 * - Batch.sales Objekt → Sale[]
 * - Batch.productId zeigt auf CatalogProduct
 */
export function migrateAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_DATA };
  }

  const input = raw as RawAppData;
  const suppliers = Array.isArray(input.suppliers) ? input.suppliers : [];
  const dealers = Array.isArray(input.dealers)
    ? input.dealers.map((d) => ({
        ...d,
        currency: d.currency || "EUR",
      }))
    : [];
  const overheadItems = Array.isArray(input.overheadItems)
    ? input.overheadItems
    : [];

  let catalogProducts: CatalogProduct[] = Array.isArray(input.catalogProducts)
    ? input.catalogProducts.map((raw) => {
        const p = raw as Partial<CatalogProduct> & {
          sellPrice?: number;
          listPrice?: number | null;
          plannedMonthlyQuantity?: number | null;
        };
        return {
          id: p.id || createId("cat"),
          name: p.name || "",
          sku: p.sku || "",
          listPrice:
            p.listPrice !== undefined
              ? p.listPrice
              : typeof p.sellPrice === "number"
                ? p.sellPrice
                : null,
          pricingUnit: p.pricingUnit || "pcs",
          currency: p.currency || "EUR",
          status: p.status === "inactive" ? "inactive" : "active",
          category: p.category || "",
          targetMarginPercent: p.targetMarginPercent ?? null,
          notes: p.notes || "",
          createdAt: p.createdAt || new Date().toISOString(),
        };
      })
    : [];

  let components: Component[] = Array.isArray(input.components)
    ? input.components.map((c) => ({
        id: c.id || createId("cmp"),
        productId: c.productId || "",
        supplierId: c.supplierId || "",
        name: c.name || "",
        purchasePricePerUnit: c.purchasePricePerUnit ?? 0,
        quantityPerProductUnit: c.quantityPerProductUnit ?? 1,
      }))
    : [];

  const legacyProducts = Array.isArray(input.products) ? input.products : [];
  const productIdRemap = new Map<string, string>();

  // Alte Beschaffungs-„Produkte“ → CatalogProduct + eine BOM-Komponente
  // (nur wenn noch keine Components existieren — sonst schon migriert)
  if (legacyProducts.length > 0) {
    const alreadyMigrated =
      components.length > 0 &&
      legacyProducts.every((lp) =>
        catalogProducts.some((c) => c.id === lp.id),
      );

    if (!alreadyMigrated && components.length === 0) {
      for (const legacy of legacyProducts) {
        const existingCatalog = catalogProducts.find(
          (c) =>
            (c.sku &&
              legacy.sku &&
              c.sku.toLowerCase() === legacy.sku.toLowerCase()) ||
            c.id === legacy.id,
        );
        const catalogId = existingCatalog?.id ?? legacy.id;
        if (!existingCatalog) {
          catalogProducts.push({
            id: catalogId,
            name: legacy.name || "Produkt",
            sku: legacy.sku || "",
            listPrice: null,
            pricingUnit: legacy.pricingUnit || "pcs",
            currency: legacy.currency || "EUR",
            status: "active",
            category: "",
            targetMarginPercent: null,
            notes: "",
            createdAt: legacy.createdAt || new Date().toISOString(),
          });
        }
        productIdRemap.set(legacy.id, catalogId);
        components.push({
          id: createId("cmp"),
          productId: catalogId,
          supplierId: legacy.supplierId || "",
          name: legacy.name || "Komponente",
          purchasePricePerUnit: legacy.unitPrice ?? 0,
          quantityPerProductUnit: 1,
        });
      }
    } else if (legacyProducts.length > 0 && components.length === 0) {
      // Fallback: products exist but remap by id for batches
      for (const legacy of legacyProducts) {
        productIdRemap.set(legacy.id, legacy.id);
      }
    }
  }

  const batches: Batch[] = Array.isArray(input.batches)
    ? input.batches.map((b) => {
        const remappedProductId =
          productIdRemap.get(b.productId) ?? b.productId;
        let sales: Sale[] = [];
        if (isSaleArray(b.sales)) {
          sales = b.sales.map((s) => ({
            id: s.id || createId("sale"),
            dealerId: s.dealerId ?? null,
            salePricePerUnit: s.salePricePerUnit ?? null,
            quantity: s.quantity ?? b.quantity ?? 0,
            channel: s.channel || "",
            costItems: s.costItems ?? null,
          }));
        } else if (isLegacySalesData(b.sales)) {
          sales = [legacySalesToSale(b.sales, b.quantity ?? 0)];
        } else {
          sales = [
            {
              id: createId("sale"),
              dealerId: null,
              salePricePerUnit: 0,
              quantity: b.quantity ?? 0,
              channel: "",
              costItems: [],
            },
          ];
        }

        return {
          id: b.id || createId("bat"),
          productId: remappedProductId,
          supplierId: b.supplierId || "",
          label: b.label || "",
          quantity: b.quantity ?? 0,
          unitPurchasePrice:
            "unitPurchasePrice" in b ? (b.unitPurchasePrice ?? null) : null,
          currency: b.currency ?? null,
          paymentDays: b.paymentDays ?? null,
          paymentUnit: b.paymentUnit ?? null,
          skontoPercent: b.skontoPercent ?? null,
          skontoDays: b.skontoDays ?? null,
          incoterm: b.incoterm ?? null,
          costItems: Array.isArray(b.costItems) ? b.costItems : [],
          sales,
          createdAt: b.createdAt || new Date().toISOString(),
        };
      })
    : [];

  const migratedOverhead = overheadItems.map((item) => {
    const createdAt =
      typeof item.createdAt === "string" && item.createdAt
        ? item.createdAt
        : new Date().toISOString();
    const withValidity = {
      ...item,
      kategorie: migrateOverheadCategory(item.kategorie),
      kostenart: migrateOverheadCostBehavior(
        (item as { kostenart?: unknown }).kostenart,
      ),
      variableBasis: migrateOverheadVariableBasis(
        (item as { variableBasis?: unknown }).variableBasis,
      ),
      variableRate:
        typeof (item as { variableRate?: unknown }).variableRate === "number" &&
        Number.isFinite((item as { variableRate: number }).variableRate)
          ? (item as { variableRate: number }).variableRate
          : null,
      gueltigVon:
        typeof item.gueltigVon === "string" && item.gueltigVon
          ? item.gueltigVon
          : null,
      gueltigBis:
        typeof item.gueltigBis === "string" && item.gueltigBis
          ? item.gueltigBis
          : null,
      createdAt,
      updatedAt:
        typeof (item as { updatedAt?: unknown }).updatedAt === "string" &&
        (item as { updatedAt?: string }).updatedAt
          ? (item as { updatedAt: string }).updatedAt
          : createdAt,
      updatedBy:
        typeof (item as { updatedBy?: unknown }).updatedBy === "string" &&
        (item as { updatedBy?: string }).updatedBy
          ? (item as { updatedBy: string }).updatedBy
          : null,
    };
    if (!withValidity.manuelleAufteilung) return withValidity;
    return {
      ...withValidity,
      manuelleAufteilung: withValidity.manuelleAufteilung.map((share) => ({
        ...share,
        productId: productIdRemap.get(share.productId) ?? share.productId,
      })),
    };
  });

  const rawActuals = Array.isArray(input.overheadActuals)
    ? input.overheadActuals
    : [];
  const migratedActuals: OverheadActual[] = [];
  for (const raw of rawActuals) {
    const month =
      typeof raw.month === "string" && /^\d{4}-\d{2}$/.test(raw.month)
        ? raw.month
        : null;
    if (!month) continue;
    const kategorie = migrateOverheadCategory(raw.kategorie);
    const betrag = Number(raw.betrag);
    if (!Number.isFinite(betrag) || betrag === 0) continue;
    const nameFromNote =
      typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : "";
    const name =
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : nameFromNote || "Ausgabe";
    const createdAt =
      typeof raw.createdAt === "string" && raw.createdAt
        ? raw.createdAt
        : new Date().toISOString();
    migratedActuals.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : createId("oha"),
      name,
      month,
      kategorie,
      betrag,
      overheadItemId:
        typeof raw.overheadItemId === "string" && raw.overheadItemId
          ? raw.overheadItemId
          : null,
      note:
        typeof raw.note === "string" &&
        raw.note.trim() &&
        raw.note.trim() !== name
          ? raw.note.trim()
          : null,
      createdAt,
      updatedAt:
        typeof raw.updatedAt === "string" && raw.updatedAt
          ? raw.updatedAt
          : createdAt,
      updatedBy:
        typeof raw.updatedBy === "string" && raw.updatedBy
          ? raw.updatedBy
          : null,
    });
  }

  const existingSalesPlan: SalesPlanCell[] = Array.isArray(
    (input as { salesPlan?: unknown }).salesPlan,
  )
    ? ((input as { salesPlan: unknown[] }).salesPlan
        .map((raw) =>
          normalizeSalesPlanCell(
            (raw ?? {}) as Partial<SalesPlanCell> & Record<string, unknown>,
          ),
        )
        .filter((c): c is SalesPlanCell => Boolean(c)))
    : [];

  // Legacy: flat plannedMonthlyQuantity → 12 Monate des aktuellen Jahres
  const legacyPlanUpdates: SalesPlanCell[] = [];
  const migrateYear = new Date().getFullYear();
  const rawCatalog = Array.isArray(input.catalogProducts)
    ? input.catalogProducts
    : [];
  for (const raw of rawCatalog) {
    const p = raw as {
      id?: string;
      plannedMonthlyQuantity?: unknown;
    };
    if (!p.id) continue;
    if (
      typeof p.plannedMonthlyQuantity !== "number" ||
      !Number.isFinite(p.plannedMonthlyQuantity) ||
      p.plannedMonthlyQuantity <= 0
    ) {
      continue;
    }
    const alreadyHasYear = monthKeysForYear(migrateYear).some((month) =>
      existingSalesPlan.some(
        (c) => c.productId === p.id && c.month === month,
      ),
    );
    if (alreadyHasYear) continue;
    legacyPlanUpdates.push(
      ...cellsForProductYear(
        p.id,
        migrateYear,
        Array.from({ length: 12 }, () => p.plannedMonthlyQuantity as number),
        null,
      ),
    );
  }

  const salesPlan = mergeSalesPlan(existingSalesPlan, legacyPlanUpdates);

  const salesPlanRowMeta: SalesPlanRowMeta[] = Array.isArray(
    (input as { salesPlanRowMeta?: unknown }).salesPlanRowMeta,
  )
    ? mergeSalesPlanRowMeta(
        [],
        ((input as { salesPlanRowMeta: unknown[] }).salesPlanRowMeta
          .map((raw) =>
            normalizeSalesPlanRowMeta(
              (raw ?? {}) as Partial<SalesPlanRowMeta> &
                Record<string, unknown>,
            ),
          )
          .filter((m): m is SalesPlanRowMeta => Boolean(m))),
      )
    : [];

  const salesPlanSettings = normalizeSalesPlanSettings(
    (input as { salesPlanSettings?: unknown }).salesPlanSettings as
      | Parameters<typeof normalizeSalesPlanSettings>[0]
      | undefined,
  );

  return {
    suppliers,
    catalogProducts,
    components,
    dealers,
    batches,
    overheadItems: migratedOverhead,
    overheadActuals: migratedActuals.sort((a, b) =>
      a.month === b.month
        ? a.name.localeCompare(b.name)
        : a.month.localeCompare(b.month),
    ),
    salesPlan,
    salesPlanRowMeta,
    salesPlanSettings,
    products: [],
  };
}

export function emptySale(quantity = 0): Sale {
  return {
    id: createId("sale"),
    dealerId: null,
    salePricePerUnit: 0,
    quantity,
    channel: "",
    costItems: [],
  };
}

export function emptyComponent(
  productId: string,
  supplierId = "",
): Component {
  return {
    id: createId("cmp"),
    productId,
    supplierId,
    name: "",
    purchasePricePerUnit: 0,
    quantityPerProductUnit: 1,
  };
}

/** Summe EK pro Verkaufseinheit aus BOM-Komponenten */
export function catalogProductUnitPurchaseCost(
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

export function primarySale(batch: Batch): Sale | undefined {
  return batch.sales[0];
}

/** Adapter: Sale → SalesData (Legacy-UI-Helfer) */
export function saleAsSalesData(sale: Sale | undefined, qty: number): SalesData {
  if (!sale) {
    return {
      sellPrice: 0,
      quantity: qty,
      channel: "",
      dealerId: null,
      costItems: [],
    };
  }
  return {
    sellPrice: sale.salePricePerUnit,
    quantity: sale.quantity,
    channel: sale.channel,
    dealerId: sale.dealerId,
    costItems: sale.costItems,
  };
}

export function mergeCostItems(items: CostItem[][]): CostItem[] {
  return items.flat();
}

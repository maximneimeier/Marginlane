import {
  cellsForProductYear,
  mergeSalesPlan,
  mergeSalesPlanRowMeta,
  monthKeysForYear,
  normalizeSalesPlanCell,
  normalizeSalesPlanRowMeta,
  normalizeSalesPlanSettings,
} from "./salesPlan";
import { normalizeCompanySettings } from "./companySettings";
import {
  normalizeLogisticsBuildingBlock,
  normalizeLogisticsTemplate,
} from "./logistics";
import { normalizePersonnelRole, normalizePersonnelTeam } from "./personnel";
import type {
  AppData,
  Batch,
  CatalogProduct,
  Component,
  CostItem,
  OverheadActual,
  Product,
  ProductComponent,
  ProductDocument,
  Sale,
  SalesData,
  SalesPlanCell,
  SalesPlanRowMeta,
} from "./types";
import { MAX_PRODUCT_DOCUMENTS } from "./types";
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
 * - Product (alte Komponenten) → Component + ProductComponent (+ ggf. CatalogProduct)
 * - Component.productId (1:1) → Component-Stamm + ProductComponent (n:m)
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
          documents: normalizeProductDocuments(
            (p as { documents?: unknown }).documents,
          ),
          createdAt: p.createdAt || new Date().toISOString(),
        };
      })
    : [];

  type LegacyComponent = Partial<Component> & {
    id?: string;
    productId?: string;
    quantityPerProductUnit?: number;
    purchasePricePerUnit?: number;
    supplierId?: string;
    name?: string;
    sku?: string;
    currency?: string | null;
    notes?: string;
  };

  const rawComponents: LegacyComponent[] = Array.isArray(input.components)
    ? (input.components as LegacyComponent[])
    : [];

  const existingLinksRaw = Array.isArray(
    (input as { productComponents?: unknown }).productComponents,
  )
    ? ((input as { productComponents: unknown[] }).productComponents as Array<
        Partial<ProductComponent>
      >)
    : [];

  const hasLegacyProductId = rawComponents.some(
    (c) => typeof c.productId === "string" && c.productId.length > 0,
  );
  const alreadyNm =
    existingLinksRaw.length > 0 ||
    (rawComponents.length > 0 && !hasLegacyProductId);

  let components: Component[] = [];
  let productComponents: ProductComponent[] = [];

  if (alreadyNm && !hasLegacyProductId) {
    components = rawComponents.map((c) => normalizeComponentStamm(c));
    productComponents = existingLinksRaw.map((pc) =>
      normalizeProductComponent(pc),
    );
  } else {
    // Legacy 1:1 Component.productId → Stamm + Link (kein Deduplizieren)
    for (const c of rawComponents) {
      const id = c.id || createId("cmp");
      components.push(normalizeComponentStamm({ ...c, id }));
      if (c.productId) {
        productComponents.push({
          id: `pc_${id}`,
          productId: c.productId,
          componentId: id,
          quantityPerProductUnit:
            typeof c.quantityPerProductUnit === "number"
              ? c.quantityPerProductUnit
              : 1,
          purchasePriceOverride: null,
        });
      }
    }
    // Bereits vorhandene Links (falls Dual-Write) mergen by id
    for (const pc of existingLinksRaw) {
      const normalized = normalizeProductComponent(pc);
      if (!productComponents.some((x) => x.id === normalized.id)) {
        productComponents.push(normalized);
      }
    }
  }

  const legacyProducts = Array.isArray(input.products) ? input.products : [];
  const productIdRemap = new Map<string, string>();

  // Alte Beschaffungs-„Produkte“ → CatalogProduct + Component + ProductComponent
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
            documents: [],
            createdAt: legacy.createdAt || new Date().toISOString(),
          });
        }
        productIdRemap.set(legacy.id, catalogId);
        const cmpId = createId("cmp");
        components.push({
          id: cmpId,
          supplierId: legacy.supplierId || "",
          name: legacy.name || "Komponente",
          sku: legacy.sku || "",
          currency: legacy.currency ?? null,
          purchasePricePerUnit: legacy.unitPrice ?? 0,
          notes: "",
        });
        productComponents.push({
          id: `pc_${cmpId}`,
          productId: catalogId,
          componentId: cmpId,
          quantityPerProductUnit: 1,
          purchasePriceOverride: null,
        });
      }
    } else if (legacyProducts.length > 0 && components.length === 0) {
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

  const companySettings = normalizeCompanySettings(
    (input as { companySettings?: unknown }).companySettings as
      | Parameters<typeof normalizeCompanySettings>[0]
      | undefined,
  );

  const logisticsBuildingBlocks = Array.isArray(
    (input as { logisticsBuildingBlocks?: unknown }).logisticsBuildingBlocks,
  )
    ? (
        (input as { logisticsBuildingBlocks: unknown[] })
          .logisticsBuildingBlocks
      ).map((raw) =>
        normalizeLogisticsBuildingBlock(
          (raw ?? {}) as Parameters<typeof normalizeLogisticsBuildingBlock>[0],
        ),
      )
    : [];

  const logisticsTemplates = Array.isArray(
    (input as { logisticsTemplates?: unknown }).logisticsTemplates,
  )
    ? (
        (input as { logisticsTemplates: unknown[] }).logisticsTemplates
      ).map((raw) =>
        normalizeLogisticsTemplate(
          (raw ?? {}) as Parameters<typeof normalizeLogisticsTemplate>[0],
        ),
      )
    : [];

  const personnelTeams = Array.isArray(
    (input as { personnelTeams?: unknown }).personnelTeams,
  )
    ? (
        (input as { personnelTeams: unknown[] }).personnelTeams
      ).map((raw) =>
        normalizePersonnelTeam(
          (raw ?? {}) as Parameters<typeof normalizePersonnelTeam>[0],
        ),
      )
    : [];

  const personnelRoles = Array.isArray(
    (input as { personnelRoles?: unknown }).personnelRoles,
  )
    ? (
        (input as { personnelRoles: unknown[] }).personnelRoles
      ).map((raw) =>
        normalizePersonnelRole(
          (raw ?? {}) as Parameters<typeof normalizePersonnelRole>[0],
        ),
      )
    : [];

  return {
    suppliers,
    catalogProducts,
    components,
    productComponents,
    dealers,
    batches,
    logisticsBuildingBlocks,
    logisticsTemplates,
    overheadItems: migratedOverhead,
    overheadActuals: migratedActuals.sort((a, b) =>
      a.month === b.month
        ? a.name.localeCompare(b.name)
        : a.month.localeCompare(b.month),
    ),
    personnelTeams,
    personnelRoles,
    salesPlan,
    salesPlanRowMeta,
    salesPlanSettings,
    companySettings,
    products: [],
  };
}

function normalizeComponentStamm(
  c: Partial<Component> & {
    id?: string;
    purchasePricePerUnit?: number;
    supplierId?: string;
    name?: string;
    sku?: string;
    currency?: string | null;
    notes?: string;
  },
): Component {
  return {
    id: c.id || createId("cmp"),
    supplierId: c.supplierId || "",
    name: c.name || "",
    sku: typeof c.sku === "string" ? c.sku : "",
    currency:
      c.currency === null || c.currency === undefined
        ? null
        : String(c.currency) || null,
    purchasePricePerUnit: c.purchasePricePerUnit ?? 0,
    notes: typeof c.notes === "string" ? c.notes : "",
  };
}

function normalizeProductComponent(
  pc: Partial<ProductComponent>,
): ProductComponent {
  const override =
    pc.purchasePriceOverride === null || pc.purchasePriceOverride === undefined
      ? null
      : Number(pc.purchasePriceOverride);
  return {
    id: pc.id || createId("pc"),
    productId: pc.productId || "",
    componentId: pc.componentId || "",
    quantityPerProductUnit:
      typeof pc.quantityPerProductUnit === "number"
        ? pc.quantityPerProductUnit
        : 1,
    purchasePriceOverride:
      override != null && Number.isFinite(override) ? override : null,
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

export function emptyComponent(supplierId = ""): Component {
  return {
    id: createId("cmp"),
    supplierId,
    name: "",
    sku: "",
    currency: supplierId ? null : "EUR",
    purchasePricePerUnit: 0,
    notes: "",
  };
}

export function emptyProductComponent(
  productId = "",
  componentId = "",
): ProductComponent {
  return {
    id: createId("pc"),
    productId,
    componentId,
    quantityPerProductUnit: 1,
    purchasePriceOverride: null,
  };
}

export function emptyProductDocument(): ProductDocument {
  return {
    id: createId("doc"),
    title: "",
    url: "",
    notes: "",
  };
}

export function normalizeProductDocuments(raw: unknown): ProductDocument[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductDocument[] = [];
  for (const item of raw) {
    if (out.length >= MAX_PRODUCT_DOCUMENTS) break;
    const d = item as Partial<ProductDocument>;
    out.push({
      id: typeof d.id === "string" && d.id ? d.id : createId("doc"),
      title: typeof d.title === "string" ? d.title : "",
      url: typeof d.url === "string" ? d.url : "",
      notes: typeof d.notes === "string" ? d.notes : "",
    });
  }
  return out;
}

/** Effektiver EK/Einheit für eine BOM-Zeile */
export function effectiveComponentUnitPrice(
  component: Component,
  link: ProductComponent,
): number {
  if (
    link.purchasePriceOverride !== null &&
    link.purchasePriceOverride !== undefined
  ) {
    return link.purchasePriceOverride;
  }
  return component.purchasePricePerUnit;
}

/** Summe EK pro Verkaufseinheit aus BOM (ProductComponent Join) */
export function catalogProductUnitPurchaseCost(
  productId: string,
  components: Component[],
  productComponents: ProductComponent[],
): number {
  const byId = new Map(components.map((c) => [c.id, c]));
  return productComponents
    .filter((pc) => pc.productId === productId)
    .reduce((sum, pc) => {
      const component = byId.get(pc.componentId);
      if (!component) return sum;
      return (
        sum +
        effectiveComponentUnitPrice(component, pc) *
          Math.max(pc.quantityPerProductUnit, 0)
      );
    }, 0);
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

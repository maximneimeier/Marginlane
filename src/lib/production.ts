import { costItemTotal, resolvePurchasePrice } from "./calc";
import { createId } from "./format";
import { convertToBase } from "./fx";
import {
  batchRemainingQuantity,
  todayIsoDate,
} from "./batchPipeline";
import { calculateResolvedEconomics } from "./resolve";
import {
  resolveComponentCurrency,
  WORKSPACE_DEFAULT_CURRENCY,
} from "./resolve";
import type {
  AppData,
  Batch,
  BatchConsumption,
  Component,
  CostItem,
  ProductComponent,
  ProductRoutingStep,
  ProductionConsumption,
  ProductionCostBasis,
  ProductionRun,
  ProductionRunInput,
  Sale,
} from "./types";
import { emptyBatchDuty } from "./types";
import {
  normalizeProductionCostBasis,
  normalizeProductionCostBasisOverride,
} from "./companySettings";

function clampScrap(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0) return 0;
  if (rate > 0.95) return 0.95;
  return rate;
}

/** Ausschuss 0–0.95 an der BOM-Position */
export function clampBomScrapRate(rate: number): number {
  return clampScrap(rate);
}

/** BOM-Menge inkl. Positions-Ausschuss */
export function bomQuantityWithScrap(pc: ProductComponent): number {
  return (
    Math.max(pc.quantityPerProductUnit, 0) *
    (1 + clampBomScrapRate(pc.scrapRate ?? 0))
  );
}

export type ProductionCostEstimate = {
  /** Gutmenge */
  outputQuantity: number;
  /** Material gesamt (Basiswährung) — inkl. Ausschussbedarf */
  materialTotal: number;
  /** Fertigungskosten gesamt (Basiswährung) */
  manufacturingTotal: number;
  /** material + manufacturing */
  totalCost: number;
  /** Material je Gutstück */
  materialPerUnit: number;
  /** Fertigung je Gutstück */
  manufacturingPerUnit: number;
  /** Gesamtkosten je Gutstück */
  unitCost: number;
  /** Input-Bedarf je Komponente (inkl. Ausschuss) */
  inputTotals: Array<{
    input: ProductionRunInput;
    component: Component | undefined;
    quantityNeeded: number;
    unitCost: number;
    lineTotal: number;
    /** Effektive Preisregel der Vorkalkulation */
    costBasis: ProductionCostBasis;
  }>;
};

export type ComponentStockLine = {
  componentId: string;
  component: Component | undefined;
  stockProductId: string | null;
  /** Physisch im Lager */
  onHand: number;
  /** Durch andere geplante Runs reserviert */
  reserved: number;
  /** onHand − reserved (nicht negativ) */
  free: number;
  needed: number;
  /** true wenn Lagerartikel verknüpft */
  tracked: boolean;
  shortfall: number;
};

export type ProductionStockCheck = {
  lines: ComponentStockLine[];
  /** Mindestens eine tracked Zeile mit Fehlmenge */
  hasShortfall: boolean;
  /** Alle Inputs ohne Lagerartikel */
  allUntracked: boolean;
};

function emptySale(quantity = 0): Sale {
  return {
    id: createId("sale"),
    dealerId: null,
    salePricePerUnit: 0,
    quantity,
    channel: "",
    costItems: [],
  };
}

function effectiveUnitPrice(
  component: Component,
  link: ProductComponent | undefined,
  orderQty: number,
  override: number | null,
): number {
  if (override != null && Number.isFinite(override)) {
    return Math.max(override, 0);
  }
  const list =
    link?.purchasePriceOverride != null
      ? link.purchasePriceOverride
      : component.purchasePricePerUnit;
  const tiers = component.discountTiers ?? [];
  if (!tiers.length) return list;
  return resolvePurchasePrice(list, orderQty, tiers).unitPrice;
}

/** Expliziter Link oder SKU-Match auf Katalogprodukt */
export function resolveComponentStockProductId(
  data: Pick<AppData, "catalogProducts">,
  component: Component | undefined,
): string | null {
  if (!component) return null;
  if (component.stockProductId) return component.stockProductId;
  const sku = component.sku.trim().toLowerCase();
  if (!sku) return null;
  const match = data.catalogProducts.find(
    (p) => p.sku.trim().toLowerCase() === sku,
  );
  return match?.id ?? null;
}

export function productOnHandQuantity(
  data: AppData,
  productId: string,
  today: string = todayIsoDate(),
): number {
  if (!productId) return 0;
  let sum = 0;
  for (const batch of data.batches) {
    if (batch.productId !== productId) continue;
    const arrival = batch.arrivalDate?.slice(0, 10) || null;
    if (!arrival || arrival > today) continue;
    sum += batchRemainingQuantity(data, batch);
  }
  return sum;
}

/** Effektive Preisregel: Komponenten-Override → Firmen-Default → Stamm-EK */
export function resolveEffectiveProductionCostBasis(
  data: Pick<AppData, "companySettings">,
  component: Component | undefined,
): ProductionCostBasis {
  const override = normalizeProductionCostBasisOverride(
    component?.costBasisOverride,
  );
  if (override) return override;
  return normalizeProductionCostBasis(
    data.companySettings?.productionCostBasis,
  );
}

function listUnitCostNative(
  component: Component,
  link: ProductComponent | undefined,
  orderQty: number,
  override: number | null,
): number {
  return effectiveUnitPrice(component, link, orderQty, override);
}

function listUnitCostBase(
  data: AppData,
  component: Component | undefined,
  link: ProductComponent | undefined,
  quantityNeeded: number,
  override: number | null,
): number {
  const baseCurrency =
    data.companySettings?.baseCurrency || WORKSPACE_DEFAULT_CURRENCY;
  const companyRates = data.companySettings?.fxRates;
  if (!component) {
    return override != null && Number.isFinite(override)
      ? Math.max(override, 0)
      : 0;
  }
  const nativeUnit = listUnitCostNative(
    component,
    link,
    quantityNeeded,
    override,
  );
  const supplier = data.suppliers.find((s) => s.id === component.supplierId);
  const currency = resolveComponentCurrency(component, supplier).value;
  return convertToBase(
    nativeUnit,
    currency,
    baseCurrency,
    companyRates,
    null,
  );
}

/** Neueste angekommene Charge → Landed Cost / Stück (Basiswährung). */
export function lastLandedUnitCostBase(
  data: AppData,
  stockProductId: string,
  today: string = todayIsoDate(),
): number | null {
  if (!stockProductId) return null;
  const candidates = data.batches
    .filter((b) => b.productId === stockProductId)
    .filter((b) => {
      const arrival = b.arrivalDate?.slice(0, 10) || null;
      return Boolean(arrival && arrival <= today);
    })
    .sort((a, b) => {
      const da = a.arrivalDate ?? a.createdAt;
      const db = b.arrivalDate ?? b.createdAt;
      return db.localeCompare(da);
    });
  const batch = candidates[0];
  if (!batch) return null;
  return calculateResolvedEconomics(data, batch).landedCostPerUnit;
}

function arrivedBatchesFifo(data: AppData, productId: string, today: string) {
  return data.batches
    .filter((b) => b.productId === productId)
    .filter((b) => {
      const arrival = b.arrivalDate?.slice(0, 10) || null;
      return Boolean(arrival && arrival <= today);
    })
    .sort((a, b) => {
      const da = a.arrivalDate ?? a.createdAt;
      const db = b.arrivalDate ?? b.createdAt;
      return da.localeCompare(db);
    });
}

/**
 * FIFO-gewichteter Landed Cost für die Vorkalkulation.
 * Fehlmenge wird mit Stamm-EK (listFallback) bewertet.
 */
export function fifoStockUnitCostBase(
  data: AppData,
  stockProductId: string,
  quantityNeeded: number,
  listFallbackBase: number,
  today: string = todayIsoDate(),
): number {
  const needed = Math.max(quantityNeeded, 0);
  if (needed <= 0) return 0;

  let remaining = needed;
  let value = 0;
  let taken = 0;

  for (const batch of arrivedBatchesFifo(data, stockProductId, today)) {
    if (remaining <= 0) break;
    const avail = remainingOnBatchLocal(data, batch);
    if (avail <= 0) continue;
    const take = Math.min(avail, remaining);
    const landed = calculateResolvedEconomics(data, batch).landedCostPerUnit;
    value += take * landed;
    taken += take;
    remaining -= take;
  }

  if (taken <= 0) return listFallbackBase;
  if (remaining > 0) value += remaining * listFallbackBase;
  return value / needed;
}

/**
 * Material-Stückkosten für die Vorkalkulation (immer Basiswährung).
 * Run-Override hat Vorrang; sonst Firmen-/Komponenten-Regel.
 */
export function resolveMaterialUnitCostForEstimate(
  data: AppData,
  component: Component | undefined,
  link: ProductComponent | undefined,
  quantityNeeded: number,
  unitCostOverride: number | null,
): { unitCost: number; costBasis: ProductionCostBasis } {
  const costBasis = resolveEffectiveProductionCostBasis(data, component);
  const listBase = listUnitCostBase(
    data,
    component,
    link,
    quantityNeeded,
    unitCostOverride,
  );

  if (unitCostOverride != null && Number.isFinite(unitCostOverride)) {
    return { unitCost: listBase, costBasis };
  }

  if (costBasis === "list") {
    return { unitCost: listBase, costBasis };
  }

  const stockProductId = resolveComponentStockProductId(data, component);
  if (!stockProductId) {
    return { unitCost: listBase, costBasis };
  }

  if (costBasis === "last_landed") {
    const landed = lastLandedUnitCostBase(data, stockProductId);
    return { unitCost: landed ?? listBase, costBasis };
  }

  return {
    unitCost: fifoStockUnitCostBase(
      data,
      stockProductId,
      quantityNeeded,
      listBase,
    ),
    costBasis,
  };
}

/** BOM → editierbare Run-Inputs (Menge inkl. BOM-Ausschuss) */
export function productionInputsFromBom(
  data: Pick<AppData, "productComponents">,
  productId: string,
): ProductionRunInput[] {
  return (data.productComponents ?? [])
    .filter((pc) => pc.productId === productId)
    .map((pc) => ({
      id: createId("pri"),
      componentId: pc.componentId,
      quantityPerOutput: bomQuantityWithScrap(pc),
      unitCostOverride: null,
    }));
}

/**
 * Arbeitsplan → Fertigungskosten-Zeilen für ein Los.
 * Rüstkosten werden auf die Output-Menge umgelegt (per_unit).
 */
export function manufacturingCostItemsFromRouting(
  steps: ProductRoutingStep[],
  outputQuantity: number,
): CostItem[] {
  const n = Math.max(outputQuantity, 1);
  const ordered = [...steps].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  return ordered
    .filter((s) => s.name.trim() || s.setupMinutes > 0 || s.runMinutesPerUnit > 0)
    .map((step) => {
      const setupCost = (Math.max(step.setupMinutes, 0) / 60) * step.hourlyRate;
      const runPerUnit =
        (Math.max(step.runMinutesPerUnit, 0) / 60) * step.hourlyRate;
      return {
        id: createId("ci"),
        type: step.rateType === "machine" ? "machine" : "labor",
        label: step.name.trim() || "Schritt",
        amount: runPerUnit + setupCost / n,
        allocation: "per_unit" as const,
        phase: "einkauf" as const,
      };
    });
}

/** Fertigung €/Stück bei gegebener Losgröße (Rüst umgelegt) */
export function estimateRoutingCostPerUnit(
  steps: ProductRoutingStep[],
  outputQuantity: number,
): number {
  return manufacturingCostItemsFromRouting(steps, outputQuantity).reduce(
    (sum, item) => sum + Math.max(item.amount, 0),
    0,
  );
}

/**
 * Kalkulation Stufe 1: Material aus Inputs (FX → Basis) + Fertigungskosten.
 * Ausschuss erhöht den Materialbedarf, nicht die Gutmenge.
 * Material-EK folgt `productionCostBasis` (bzw. Komponenten-Override);
 * Abbuchung beim Abschluss bleibt unabhängig davon FIFO-Landed.
 */
export function estimateProductionRun(
  data: AppData,
  run: Pick<
    ProductionRun,
    "outputProductId" | "outputQuantity" | "scrapRate" | "inputs" | "costItems"
  >,
): ProductionCostEstimate {
  const outputQuantity = Math.max(run.outputQuantity, 0);
  const scrap = clampScrap(run.scrapRate);
  const demandFactor = scrap >= 1 ? 1 : 1 / (1 - scrap);

  const byComponent = new Map(data.components.map((c) => [c.id, c]));
  const bomLinks = (data.productComponents ?? []).filter(
    (pc) => pc.productId === run.outputProductId,
  );

  const inputTotals: ProductionCostEstimate["inputTotals"] = [];
  let materialTotal = 0;

  for (const input of run.inputs) {
    const component = byComponent.get(input.componentId);
    const link = bomLinks.find((pc) => pc.componentId === input.componentId);
    const qtyPer = Math.max(input.quantityPerOutput, 0);
    const quantityNeeded = outputQuantity * qtyPer * demandFactor;
    const { unitCost, costBasis } = resolveMaterialUnitCostForEstimate(
      data,
      component,
      link,
      quantityNeeded,
      input.unitCostOverride,
    );
    const lineTotal = unitCost * quantityNeeded;
    materialTotal += lineTotal;
    inputTotals.push({
      input,
      component,
      quantityNeeded,
      unitCost,
      lineTotal,
      costBasis,
    });
  }

  let manufacturingTotal = 0;
  for (const item of run.costItems) {
    manufacturingTotal += costItemTotal(item, outputQuantity, materialTotal);
  }

  const totalCost = materialTotal + manufacturingTotal;
  const materialPerUnit =
    outputQuantity > 0 ? materialTotal / outputQuantity : 0;
  const manufacturingPerUnit =
    outputQuantity > 0 ? manufacturingTotal / outputQuantity : 0;
  const unitCost = outputQuantity > 0 ? totalCost / outputQuantity : 0;

  return {
    outputQuantity,
    materialTotal,
    manufacturingTotal,
    totalCost,
    materialPerUnit,
    manufacturingPerUnit,
    unitCost,
    inputTotals,
  };
}

/** WIP-Reservierung geplanter Runs je Komponente (optional einen Run ausschließen) */
export function reservedComponentDemand(
  data: AppData,
  componentId: string,
  excludeRunId?: string,
): number {
  let reserved = 0;
  for (const run of data.productionRuns ?? []) {
    if (run.status !== "planned") continue;
    if (excludeRunId && run.id === excludeRunId) continue;
    const estimate = estimateProductionRun(data, run);
    for (const row of estimate.inputTotals) {
      if (row.input.componentId === componentId) {
        reserved += row.quantityNeeded;
      }
    }
  }
  return reserved;
}

export function checkProductionStock(
  data: AppData,
  run: ProductionRun,
): ProductionStockCheck {
  const estimate = estimateProductionRun(data, run);
  const lines: ComponentStockLine[] = estimate.inputTotals.map((row) => {
    const stockProductId = resolveComponentStockProductId(data, row.component);
    const tracked = Boolean(stockProductId);
    const onHand = tracked
      ? productOnHandQuantity(data, stockProductId!)
      : 0;
    const reserved = reservedComponentDemand(
      data,
      row.input.componentId,
      run.id,
    );
    const free = tracked ? Math.max(onHand - reserved, 0) : Number.POSITIVE_INFINITY;
    const needed = row.quantityNeeded;
    const shortfall = tracked ? Math.max(needed - free, 0) : 0;
    return {
      componentId: row.input.componentId,
      component: row.component,
      stockProductId,
      onHand,
      reserved,
      free: tracked ? free : 0,
      needed,
      tracked,
      shortfall,
    };
  });

  const tracked = lines.filter((l) => l.tracked);
  return {
    lines,
    hasShortfall: tracked.some((l) => l.shortfall > 0),
    allUntracked: lines.length > 0 && tracked.length === 0,
  };
}

function remainingOnBatchLocal(data: AppData, batch: Batch): number {
  const stock =
    batch.receivedQuantity != null && batch.receivedQuantity >= 0
      ? batch.receivedQuantity
      : batch.quantity;
  const sold = calculateResolvedEconomics(data, batch).salesAggregate
    .soldQuantity;
  const consumed = (batch.consumptions ?? []).reduce(
    (s, c) => s + Math.max(c.quantity, 0),
    0,
  );
  return Math.max(stock - sold - consumed, 0);
}

/**
 * FIFO: älteste angekommene Chargen zuerst abbuchen.
 */
export function allocateFifoConsumptions(
  data: AppData,
  productId: string,
  quantityNeeded: number,
  meta: { productionRunId: string; componentId: string },
  working: Map<string, Batch>,
): { allocations: ProductionConsumption[]; batchPatches: Batch[] } | null {
  let remaining = quantityNeeded;
  if (remaining <= 0) return { allocations: [], batchPatches: [] };

  const today = todayIsoDate();
  const mergeBatch = (b: Batch) => working.get(b.id) ?? b;
  const dataWithWorking = (): AppData => ({
    ...data,
    batches: data.batches.map(mergeBatch),
  });

  const candidates = data.batches
    .filter((b) => b.productId === productId)
    .map(mergeBatch)
    .filter((b) => {
      const arrival = b.arrivalDate?.slice(0, 10) || null;
      if (!arrival || arrival > today) return false;
      return remainingOnBatchLocal(dataWithWorking(), b) > 0;
    })
    .sort((a, b) => {
      const da = a.arrivalDate ?? a.createdAt;
      const db = b.arrivalDate ?? b.createdAt;
      return da.localeCompare(db);
    });

  const allocations: ProductionConsumption[] = [];
  const now = new Date().toISOString();
  const patchedIds = new Set<string>();

  for (const batch of candidates) {
    if (remaining <= 0) break;
    const current = mergeBatch(batch);
    const avail = remainingOnBatchLocal(dataWithWorking(), current);
    if (avail <= 0) continue;
    const take = Math.min(avail, remaining);
    const consumption: BatchConsumption = {
      id: createId("bcon"),
      productionRunId: meta.productionRunId,
      componentId: meta.componentId,
      quantity: take,
      createdAt: now,
    };
    const next: Batch = {
      ...current,
      consumptions: [...(current.consumptions ?? []), consumption],
    };
    working.set(batch.id, next);
    patchedIds.add(batch.id);
    allocations.push({
      id: createId("pcon"),
      componentId: meta.componentId,
      batchId: batch.id,
      quantity: take,
    });
    remaining -= take;
  }

  if (remaining > 1e-9) return null;
  return {
    allocations,
    batchPatches: [...patchedIds].map((id) => working.get(id)!),
  };
}

export function emptyProductionRun(
  partial?: Partial<ProductionRun>,
): ProductionRun {
  return {
    id: createId("prun"),
    label: "",
    outputProductId: "",
    outputQuantity: 100,
    scrapRate: 0,
    inputs: [],
    costItems: [],
    status: "planned",
    notes: "",
    createdAt: new Date().toISOString(),
    completedAt: null,
    outputBatchId: null,
    consumptions: [],
    ...partial,
  };
}

function normalizeCostItems(raw: unknown): CostItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is CostItem =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : createId("cost"),
      type: typeof item.type === "string" ? item.type : "Sonstiges",
      label: typeof item.label === "string" ? item.label : "",
      amount: typeof item.amount === "number" ? item.amount : 0,
      allocation:
        item.allocation === "per_unit" ||
        item.allocation === "percent_of_goods" ||
        item.allocation === "lump_sum"
          ? item.allocation
          : "lump_sum",
      phase:
        item.phase === "einkauf" ||
        item.phase === "transport" ||
        item.phase === "lager" ||
        item.phase === "vertrieb"
          ? item.phase
          : "einkauf",
    }));
}

export function normalizeProductionRun(
  raw: Partial<ProductionRun> & { id?: string },
): ProductionRun {
  const status =
    raw.status === "done" ||
    raw.status === "cancelled" ||
    raw.status === "planned"
      ? raw.status
      : "planned";
  const inputs = Array.isArray(raw.inputs)
    ? raw.inputs
        .filter((i) => i && typeof i === "object")
        .map((i) => ({
          id: typeof i.id === "string" ? i.id : createId("pri"),
          componentId: typeof i.componentId === "string" ? i.componentId : "",
          quantityPerOutput:
            typeof i.quantityPerOutput === "number"
              ? Math.max(i.quantityPerOutput, 0)
              : 0,
          unitCostOverride:
            i.unitCostOverride != null && Number.isFinite(i.unitCostOverride)
              ? i.unitCostOverride
              : null,
        }))
    : [];

  const consumptions = Array.isArray(raw.consumptions)
    ? raw.consumptions
        .filter((c) => c && typeof c === "object")
        .map((c) => ({
          id: typeof c.id === "string" ? c.id : createId("pcon"),
          componentId: typeof c.componentId === "string" ? c.componentId : "",
          batchId: typeof c.batchId === "string" ? c.batchId : "",
          quantity:
            typeof c.quantity === "number" ? Math.max(c.quantity, 0) : 0,
        }))
    : [];

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId("prun"),
    label: typeof raw.label === "string" ? raw.label : "",
    outputProductId:
      typeof raw.outputProductId === "string" ? raw.outputProductId : "",
    outputQuantity:
      typeof raw.outputQuantity === "number"
        ? Math.max(raw.outputQuantity, 0)
        : 0,
    scrapRate: clampScrap(
      typeof raw.scrapRate === "number" ? raw.scrapRate : 0,
    ),
    inputs,
    costItems: normalizeCostItems(raw.costItems),
    status,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
    outputBatchId:
      typeof raw.outputBatchId === "string" ? raw.outputBatchId : null,
    consumptions,
  };
}

export type CompleteProductionResult = {
  run: ProductionRun;
  batch: Batch;
  updatedBatches: Batch[];
  stockCheck: ProductionStockCheck;
};

/**
 * Schließt einen geplanten Run ab: FIFO-Abbuchung vom Komponentenlager,
 * Fertigware-Charge im Lager. Material-EK der Abbuchung immer aus tatsächlichen
 * Landed Costs der verbrauchten Chargen — unabhängig von `productionCostBasis`
 * (die nur die Vorkalkulation steuert). Untracked Inputs: Stammdaten-EK.
 */
export function completeProductionRun(
  data: AppData,
  run: ProductionRun,
  options?: { allowShortfall?: boolean },
): CompleteProductionResult | null {
  if (run.status !== "planned") return null;
  if (!run.outputProductId || run.outputQuantity <= 0) return null;

  const estimate = estimateProductionRun(data, run);
  const stockCheck = checkProductionStock(data, run);
  if (stockCheck.hasShortfall && !options?.allowShortfall) {
    return null;
  }

  const working = new Map<string, Batch>();
  const allConsumptions: ProductionConsumption[] = [];
  let consumedMaterialValue = 0;
  let untrackedMaterialValue = 0;

  for (const row of estimate.inputTotals) {
    const stockProductId = resolveComponentStockProductId(data, row.component);
    if (!stockProductId || row.quantityNeeded <= 0) {
      untrackedMaterialValue += row.lineTotal;
      continue;
    }

    const allocated = allocateFifoConsumptions(
      data,
      stockProductId,
      row.quantityNeeded,
      { productionRunId: run.id, componentId: row.input.componentId },
      working,
    );
    if (!allocated) {
      if (!options?.allowShortfall) return null;
      // Partial: use what we can — but allocateFifo returns null if incomplete.
      // Fall back to untracked valuation for the line.
      untrackedMaterialValue += row.lineTotal;
      continue;
    }

    for (const alloc of allocated.allocations) {
      allConsumptions.push(alloc);
      const source =
        working.get(alloc.batchId) ??
        data.batches.find((b) => b.id === alloc.batchId);
      if (source) {
        const econ = calculateResolvedEconomics(data, source);
        consumedMaterialValue += alloc.quantity * econ.landedCostPerUnit;
      } else {
        untrackedMaterialValue += alloc.quantity * row.unitCost;
      }
    }
  }

  const materialTotal = consumedMaterialValue + untrackedMaterialValue;
  const materialPerUnit =
    estimate.outputQuantity > 0 ? materialTotal / estimate.outputQuantity : 0;

  const baseCurrency =
    data.companySettings?.baseCurrency || WORKSPACE_DEFAULT_CURRENCY;
  const today = todayIsoDate();
  const now = new Date().toISOString();

  const firstSupplierId =
    estimate.inputTotals.find((row) => row.component?.supplierId)?.component
      ?.supplierId ?? "";

  const batchId = createId("batch");
  const manufacturingItems: CostItem[] = run.costItems.map((item) => ({
    ...item,
    id: createId("cost"),
    phase: "einkauf",
  }));

  const batch: Batch = {
    id: batchId,
    productId: run.outputProductId,
    supplierId: firstSupplierId,
    label: run.label.trim() || `Produktion ${today}`,
    quantity: estimate.outputQuantity,
    unitPurchasePrice: materialPerUnit,
    currency: baseCurrency,
    paymentDays: null,
    paymentUnit: null,
    skontoPercent: null,
    skontoDays: null,
    incoterm: null,
    costItems: manufacturingItems,
    sales: [emptySale(0)],
    consumptions: [],
    createdAt: now,
    orderDate: today,
    expectedArrivalDate: today,
    arrivalDate: today,
    soldDate: null,
    poNumber: `PROD-${run.id.slice(-6).toUpperCase()}`,
    notes: run.notes,
    receivedQuantity: estimate.outputQuantity,
    applySkonto: false,
    fxRateOverride: null,
    duty: emptyBatchDuty(),
    quotes: [],
    activeQuoteId: null,
  };

  return {
    run: {
      ...run,
      status: "done",
      completedAt: now,
      outputBatchId: batchId,
      consumptions: allConsumptions,
    },
    batch,
    updatedBatches: [...working.values()],
    stockCheck,
  };
}

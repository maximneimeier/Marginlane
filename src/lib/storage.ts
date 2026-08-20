import type {
  Batch,
  CostItem,
  Dealer,
  DealerChannel,
  OverheadAllocation,
  OverheadItem,
  OverheadPeriod,
  PaymentUnit,
  PricingUnit,
  Product,
  Sale,
  SalesData,
  Supplier,
} from "./types";
import {
  formatPaymentTerms,
  isPricingUnit,
  migrateOverheadCategory,
  migrateOverheadCostBehavior,
  migrateOverheadVariableBasis,
  OVERHEAD_ALLOCATIONS,
  OVERHEAD_PERIODS,
} from "./types";
import { createId } from "./format";
import { emptyCommercialOverrides } from "./resolve";
import { emptySale } from "./migrateAppData";
import { normalizeDuty, normalizeQuote } from "./batchQuotes";

function normalizeSupplier(raw: Partial<Supplier> & { contact?: string }): Supplier {
  const paymentDays = raw.paymentDays ?? 30;
  const paymentUnit = raw.paymentUnit ?? "Tage";
  const skontoPercent = raw.skontoPercent ?? 0;
  const skontoDays = raw.skontoDays ?? 0;
  const email =
    raw.email ||
    (raw.contact?.includes("@") ? raw.contact : "") ||
    "";
  const contactName =
    raw.contactName ||
    (!raw.contact?.includes("@") ? raw.contact || "" : "") ||
    "";

  const base = {
    paymentDays,
    paymentUnit,
    skontoPercent,
    skontoDays,
  } as const;

  return {
    id: raw.id || createId("sup"),
    name: raw.name || "",
    country: raw.country || "",
    contactName,
    email,
    phone: raw.phone || "",
    currency: raw.currency || "EUR",
    ...base,
    incoterm: raw.incoterm || "FOB",
    taxId: raw.taxId || "",
    legalForm: raw.legalForm || "",
    website: raw.website || "",
    originPort: raw.originPort || "",
    leadTimeDays: raw.leadTimeDays ?? 0,
    iban: raw.iban || "",
    certifications: raw.certifications || "",
    status: raw.status || "active",
    notes: raw.notes || "",
    paymentTerms: raw.paymentTerms || formatPaymentTerms(base),
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function normalizeDealer(raw: Partial<Dealer>): Dealer {
  const channel = (["b2b", "retail", "marketplace", "online", "other"].includes(
    raw.channel as string,
  )
    ? raw.channel
    : "b2b") as DealerChannel;

  const base: Dealer = {
    id: raw.id || createId("dlr"),
    name: raw.name || "",
    country: raw.country || "DE",
    contactName: raw.contactName || "",
    email: raw.email || "",
    phone: raw.phone || "",
    channel,
    paymentTerms: raw.paymentTerms || "",
    currency: raw.currency || "EUR",
    defaultSellPrice: raw.defaultSellPrice ?? 0,
    salesCostItems: Array.isArray(raw.salesCostItems)
      ? raw.salesCostItems.map((item) => ({
          ...item,
          id: item.id || createId("cost"),
          phase: item.phase || "vertrieb",
        }))
      : [],
    status: raw.status === "inactive" ? "inactive" : "active",
    notes: raw.notes || "",
    createdAt: raw.createdAt || new Date().toISOString(),
  };

  return enrichDealerDefaults(base);
}

/** Fehlende VK/Vertriebskosten aus Kanal- oder Namens-Vorlage ergänzen */
function enrichDealerDefaults(dealer: Dealer): Dealer {
  if (dealer.defaultSellPrice > 0 && dealer.salesCostItems.length > 0) {
    return dealer;
  }

  const byName = DEALER_PROFILE_BY_NAME[dealer.name.trim().toLowerCase()];
  const byChannel = DEALER_PROFILE_BY_CHANNEL[dealer.channel];
  const profile = byName ?? byChannel;

  return {
    ...dealer,
    defaultSellPrice:
      dealer.defaultSellPrice > 0
        ? dealer.defaultSellPrice
        : profile.defaultSellPrice,
    salesCostItems:
      dealer.salesCostItems.length > 0
        ? dealer.salesCostItems
        : profile.salesCostItems.map((item) => ({
            ...item,
            id: createId("cost"),
          })),
  };
}

type DealerProfile = {
  defaultSellPrice: number;
  salesCostItems: CostItem[];
};

const DEALER_PROFILE_BY_CHANNEL: Record<DealerChannel, DealerProfile> = {
  marketplace: {
    defaultSellPrice: 29.9,
    salesCostItems: [
      cost("Plattformgebühr", 15, "percent_of_goods", "vertrieb"),
      cost("Zahlungsgebühr", 1.9, "percent_of_goods", "vertrieb"),
      cost("Fulfillment", 2.4, "per_unit", "vertrieb"),
    ],
  },
  online: {
    defaultSellPrice: 12.99,
    salesCostItems: [
      cost("Zahlungsgebühr", 2.1, "percent_of_goods", "vertrieb"),
      cost("Versand outbound", 1.8, "per_unit", "vertrieb"),
      cost("Marketing / CAC", 1.2, "per_unit", "vertrieb"),
    ],
  },
  retail: {
    defaultSellPrice: 9.9,
    salesCostItems: [
      cost("Provision", 8, "percent_of_goods", "vertrieb", "Handelsmarge"),
      cost("Listungsgebühr", 0.35, "per_unit", "vertrieb"),
    ],
  },
  b2b: {
    defaultSellPrice: 18.5,
    salesCostItems: [
      cost("Provision", 5, "percent_of_goods", "vertrieb"),
      cost("Handling", 0.4, "per_unit", "vertrieb"),
    ],
  },
  other: {
    defaultSellPrice: 19.9,
    salesCostItems: [
      cost("Provision", 5, "percent_of_goods", "vertrieb"),
    ],
  },
};

const DEALER_PROFILE_BY_NAME: Record<string, DealerProfile> = {
  "amazon de": {
    defaultSellPrice: 29.9,
    salesCostItems: [
      cost("Plattformgebühr", 15, "percent_of_goods", "vertrieb", "Amazon Referral Fee"),
      cost("Zahlungsgebühr", 1.9, "percent_of_goods", "vertrieb"),
      cost("Fulfillment", 2.4, "per_unit", "vertrieb", "FBA"),
    ],
  },
  "eigenmarke shop": {
    defaultSellPrice: 12.99,
    salesCostItems: [
      cost("Zahlungsgebühr", 2.1, "percent_of_goods", "vertrieb", "Shopify Payments"),
      cost("Versand outbound", 1.8, "per_unit", "vertrieb"),
      cost("Marketing / CAC", 1.2, "per_unit", "vertrieb", "Ads anteilig"),
    ],
  },
  "mediamarkt saturn": {
    defaultSellPrice: 9.9,
    salesCostItems: [
      cost("Provision", 8, "percent_of_goods", "vertrieb", "Handelsmarge Retail"),
      cost("Listungsgebühr", 0.35, "per_unit", "vertrieb"),
    ],
  },
  "otto marktplatz": {
    defaultSellPrice: 24.99,
    salesCostItems: [
      cost("Plattformgebühr", 12, "percent_of_goods", "vertrieb", "Otto Provision"),
      cost("Zahlungsgebühr", 1.5, "percent_of_goods", "vertrieb"),
      cost("Versand outbound", 2.1, "per_unit", "vertrieb", "Partnerversand"),
    ],
  },
  "nordwest fachhandel gmbh": {
    defaultSellPrice: 18.5,
    salesCostItems: [
      cost("Provision", 5, "percent_of_goods", "vertrieb", "Außendienst"),
      cost("Handling", 0.4, "per_unit", "vertrieb", "Kommissionierung"),
    ],
  },
};

/** Vertriebskosten eines Händlers mit neuen IDs kopieren */
export function cloneDealerSalesCosts(dealer: Dealer): CostItem[] {
  return dealer.salesCostItems.map((item) => ({
    ...item,
    id: createId("cost"),
  }));
}

/**
 * @deprecated Nutze emptySale aus migrateAppData.
 */
export function emptySalesData(quantity = 0): SalesData {
  return {
    sellPrice: 0,
    quantity,
    channel: "",
    dealerId: null,
    costItems: [],
  };
}

export { emptySale };

/**
 * Optionale Vorlage: Sale an Händler koppeln.
 * VK & Vertriebskosten bleiben `null` (= live vom Händler erben).
 */
export function saleFromDealer(
  dealer: Dealer,
  quantity = 0,
): Pick<Sale, "dealerId" | "channel" | "salePricePerUnit" | "costItems"> & {
  quantity: number;
} {
  return {
    dealerId: dealer.id,
    channel: dealer.name,
    salePricePerUnit: null,
    costItems: null,
    quantity,
  };
}

/** @deprecated Alias — nutze saleFromDealer */
export function salesFromDealer(
  dealer: Dealer,
): Pick<SalesData, "dealerId" | "channel" | "sellPrice" | "costItems"> {
  return {
    dealerId: dealer.id,
    channel: dealer.name,
    sellPrice: null,
    costItems: null,
  };
}

/**
 * Händler-Kopplung an einem Sale lösen: geerbte Werte materialisieren.
 */
export function detachDealerFromSale(
  sale: Sale,
  dealer: Dealer | undefined,
): Sale {
  const sell =
    sale.salePricePerUnit !== null && sale.salePricePerUnit !== undefined
      ? sale.salePricePerUnit
      : (dealer?.defaultSellPrice ?? 0);
  const costs =
    sale.costItems !== null && sale.costItems !== undefined
      ? sale.costItems
      : dealer
        ? cloneDealerSalesCosts(dealer)
        : [];
  return {
    ...sale,
    dealerId: null,
    channel: sale.channel || dealer?.name || "",
    salePricePerUnit: sell,
    costItems: costs,
  };
}

/**
 * @deprecated Legacy SalesData-Adapter
 */
export function detachDealerFromSales(
  sales: SalesData,
  dealer: Dealer | undefined,
): SalesData {
  const sell =
    sales.sellPrice !== null && sales.sellPrice !== undefined
      ? sales.sellPrice
      : (dealer?.defaultSellPrice ?? 0);
  const costs =
    sales.costItems !== null && sales.costItems !== undefined
      ? sales.costItems
      : dealer
        ? cloneDealerSalesCosts(dealer)
        : [];
  return {
    ...sales,
    dealerId: null,
    channel: sales.channel || dealer?.name || "",
    sellPrice: sell,
    costItems: costs,
  };
}

function readOverride<T>(
  raw: Record<string, unknown> | undefined,
  key: string,
): T | null {
  if (!raw || !(key in raw)) return null;
  const v = raw[key];
  return v === undefined ? null : (v as T | null);
}

function normalizeCommercialOverrides(
  raw: Record<string, unknown> | undefined,
): ReturnType<typeof emptyCommercialOverrides> {
  const base = emptyCommercialOverrides();
  if (!raw) return base;
  return {
    currency: readOverride<string>(raw, "currency"),
    paymentDays: readOverride<number>(raw, "paymentDays"),
    paymentUnit: readOverride<PaymentUnit>(raw, "paymentUnit"),
    skontoPercent: readOverride<number>(raw, "skontoPercent"),
    skontoDays: readOverride<number>(raw, "skontoDays"),
    incoterm: readOverride<string>(raw, "incoterm"),
  };
}

function normalizeProduct(raw: Partial<Product> & Record<string, unknown>): Product {
  const overrides = normalizeCommercialOverrides(raw);
  const pricingUnit: PricingUnit = isPricingUnit(raw.pricingUnit)
    ? raw.pricingUnit
    : "pcs";
  return {
    id: raw.id || createId("prd"),
    supplierId: raw.supplierId || "",
    name: raw.name || "",
    sku: raw.sku || "",
    unitPrice: raw.unitPrice ?? 0,
    moq: raw.moq ?? 0,
    discountTiers: Array.isArray(raw.discountTiers) ? raw.discountTiers : [],
    pricingUnit,
    ...overrides,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function normalizeOneSale(
  raw: Partial<Sale & SalesData> | undefined,
  dealers: Dealer[],
  fallbackQty: number,
  legacySnapshot: boolean,
): Sale {
  const channel =
    (raw && "channel" in raw ? raw.channel : "") || "";
  let dealerIdRaw = (raw && "dealerId" in raw ? raw.dealerId : "") || "";
  if (!dealerIdRaw && channel) {
    const match = dealers.find(
      (d) => d.name.toLowerCase() === channel.toLowerCase(),
    );
    dealerIdRaw = match?.id ?? "";
  }
  const dealerId = dealerIdRaw || null;
  const dealer = dealerId
    ? dealers.find((d) => d.id === dealerId)
    : undefined;

  let salePricePerUnit: number | null;
  let costItems: CostItem[] | null;

  const legacySell =
    raw && "sellPrice" in raw
      ? (raw as Partial<SalesData>).sellPrice
      : undefined;
  const modernSell =
    raw && "salePricePerUnit" in raw ? raw.salePricePerUnit : undefined;

  if (modernSell === null || legacySell === null) {
    salePricePerUnit = null;
  } else if (typeof modernSell === "number") {
    salePricePerUnit = modernSell;
  } else if (typeof legacySell === "number") {
    salePricePerUnit = legacySell;
  } else if (legacySnapshot) {
    salePricePerUnit = 0;
  } else {
    salePricePerUnit = dealerId ? null : 0;
  }

  if (raw && "costItems" in raw && raw.costItems === null) {
    costItems = null;
  } else if (Array.isArray(raw?.costItems)) {
    costItems = raw!.costItems!;
  } else if (legacySnapshot) {
    costItems = [];
  } else {
    costItems = dealerId ? null : [];
  }

  if (!dealerId) {
    if (salePricePerUnit === null) salePricePerUnit = 0;
    if (costItems === null) costItems = [];
  }

  return {
    id: (raw && "id" in raw && raw.id) || createId("sale"),
    dealerId,
    salePricePerUnit,
    quantity: raw?.quantity ?? fallbackQty,
    channel: dealer?.name || channel,
    costItems,
  };
}

function normalizeSalesList(
  raw: unknown,
  dealers: Dealer[],
  fallbackQty: number,
  legacySnapshot: boolean,
): Sale[] {
  if (Array.isArray(raw)) {
    return raw.map((s) =>
      normalizeOneSale(s, dealers, fallbackQty, legacySnapshot),
    );
  }
  if (raw && typeof raw === "object") {
    return [
      normalizeOneSale(
        raw as Partial<Sale & SalesData>,
        dealers,
        fallbackQty,
        legacySnapshot,
      ),
    ];
  }
  return [emptySale(fallbackQty)];
}

function normalizeBatch(
  raw: Partial<Batch> & Record<string, unknown>,
  dealers: Dealer[],
  legacySnapshot: boolean,
): Batch {
  const overrides = normalizeCommercialOverrides(raw);
  let unitPurchasePrice: number | null;
  if ("unitPurchasePrice" in raw && raw.unitPurchasePrice === null) {
    unitPurchasePrice = null;
  } else if (typeof raw.unitPurchasePrice === "number") {
    unitPurchasePrice = raw.unitPurchasePrice;
  } else {
    unitPurchasePrice = legacySnapshot ? 0 : null;
  }

  const quantity = raw.quantity ?? 0;

  return {
    id: raw.id || createId("bat"),
    productId: raw.productId || "",
    supplierId: raw.supplierId || "",
    label: raw.label || "",
    quantity,
    unitPurchasePrice,
    ...overrides,
    costItems: Array.isArray(raw.costItems) ? raw.costItems : [],
    sales: normalizeSalesList(raw.sales, dealers, quantity, legacySnapshot),
    createdAt: raw.createdAt || new Date().toISOString(),
    orderDate:
      typeof raw.orderDate === "string" && raw.orderDate
        ? raw.orderDate
        : null,
    expectedArrivalDate:
      typeof raw.expectedArrivalDate === "string" && raw.expectedArrivalDate
        ? raw.expectedArrivalDate
        : null,
    arrivalDate:
      typeof raw.arrivalDate === "string" && raw.arrivalDate
        ? raw.arrivalDate
        : null,
    soldDate:
      typeof raw.soldDate === "string" && raw.soldDate ? raw.soldDate : null,
    poNumber: typeof raw.poNumber === "string" ? raw.poNumber : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    receivedQuantity:
      typeof raw.receivedQuantity === "number" &&
      Number.isFinite(raw.receivedQuantity) &&
      raw.receivedQuantity >= 0
        ? raw.receivedQuantity
        : null,
    applySkonto:
      typeof raw.applySkonto === "boolean" ? raw.applySkonto : null,
    fxRateOverride:
      typeof raw.fxRateOverride === "number" &&
      Number.isFinite(raw.fxRateOverride) &&
      raw.fxRateOverride > 0
        ? raw.fxRateOverride
        : null,
    duty: normalizeDuty(raw.duty),
    quotes: Array.isArray(raw.quotes)
      ? raw.quotes
          .map((q) => normalizeQuote(q))
          .filter((q): q is NonNullable<typeof q> => q != null)
      : [],
    activeQuoteId:
      typeof raw.activeQuoteId === "string" ? raw.activeQuoteId : null,
  };
}

function isOverheadPeriod(value: unknown): value is OverheadPeriod {
  return (
    typeof value === "string" &&
    (OVERHEAD_PERIODS as string[]).includes(value)
  );
}

function isOverheadAllocation(value: unknown): value is OverheadAllocation {
  return (
    typeof value === "string" &&
    (OVERHEAD_ALLOCATIONS as string[]).includes(value)
  );
}

export function normalizeOverheadItem(
  raw: Partial<OverheadItem> & Record<string, unknown>,
): OverheadItem {
  const verteilschluessel: OverheadAllocation = isOverheadAllocation(
    raw.verteilschluessel,
  )
    ? raw.verteilschluessel
    : "gleichmaessig";

  const manuelleAufteilung =
    verteilschluessel === "manuell" && Array.isArray(raw.manuelleAufteilung)
      ? raw.manuelleAufteilung
          .filter(
            (row): row is { productId: string; percent: number } =>
              Boolean(row) &&
              typeof row === "object" &&
              typeof (row as { productId?: unknown }).productId === "string" &&
              typeof (row as { percent?: unknown }).percent === "number",
          )
          .map((row) => ({
            productId: row.productId,
            percent: row.percent,
          }))
      : null;

  return {
    id: raw.id || createId("oh"),
    name: raw.name || "",
    betrag: typeof raw.betrag === "number" ? raw.betrag : 0,
    waehrung: raw.waehrung || "EUR",
    periode: isOverheadPeriod(raw.periode) ? raw.periode : "monatlich",
    kategorie: migrateOverheadCategory(raw.kategorie),
    kostenart: migrateOverheadCostBehavior(raw.kostenart),
    variableBasis: migrateOverheadVariableBasis(raw.variableBasis),
    variableRate:
      typeof raw.variableRate === "number" && Number.isFinite(raw.variableRate)
        ? raw.variableRate
        : null,
    verteilschluessel,
    manuelleAufteilung,
    gueltigVon:
      typeof raw.gueltigVon === "string" && raw.gueltigVon
        ? raw.gueltigVon
        : null,
    gueltigBis:
      typeof raw.gueltigBis === "string" && raw.gueltigBis
        ? raw.gueltigBis
        : null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : raw.createdAt || new Date().toISOString(),
    updatedBy:
      typeof raw.updatedBy === "string" && raw.updatedBy ? raw.updatedBy : null,
  };
}

function cost(
  type: string,
  amount: number,
  allocation: CostItem["allocation"],
  phase: CostItem["phase"],
  label = type,
): CostItem {
  return { id: createId("cost"), type, label, amount, allocation, phase };
}


export {
  normalizeSupplier,
  normalizeDealer,
  normalizeProduct,
  normalizeBatch,
};

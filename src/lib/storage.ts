import type {
  Batch,
  CostItem,
  Dealer,
  DealerChannel,
  OverheadAllocation,
  OverheadCategory,
  OverheadItem,
  OverheadPeriod,
  PaymentUnit,
  PricingUnit,
  Product,
  SalesData,
  Supplier,
} from "./types";
import {
  formatPaymentTerms,
  isPricingUnit,
  OVERHEAD_ALLOCATIONS,
  OVERHEAD_CATEGORIES,
  OVERHEAD_PERIODS,
} from "./types";
import { createId } from "./format";
import { emptyCommercialOverrides } from "./resolve";

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
 * Spec-SalesData ohne Händler-Kopplung — konkrete Werte auf der Charge.
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

/**
 * Optionale Vorlage: Charge an Händler koppeln.
 * VK & Vertriebskosten bleiben `null` (= live vom Händler erben).
 * channel wird als Spec-Feld vorausgefüllt.
 */
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
 * Händler-Kopplung lösen: geerbte Werte materialisieren,
 * damit SalesData spezkonform konkrete Zahlen behält.
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

function normalizeSales(
  raw: Partial<SalesData> | undefined,
  dealers: Dealer[],
  legacySnapshot: boolean,
): SalesData {
  const channel = raw?.channel || "";
  let dealerIdRaw = raw?.dealerId || "";
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

  // null = vom Händler erben (nur sinnvoll mit dealerId).
  // Legacy-Snapshots behalten Zahlen/Arrays als Charge-Werte.
  let sellPrice: number | null;
  let costItems: CostItem[] | null;

  if (raw && "sellPrice" in raw && raw.sellPrice === null) {
    sellPrice = null;
  } else if (raw?.sellPrice != null) {
    sellPrice = raw.sellPrice;
  } else if (legacySnapshot) {
    sellPrice = 0;
  } else {
    sellPrice = dealerId ? null : 0;
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

  // Spec: ohne Händler-Vorlage hält SalesData konkrete Werte
  if (!dealerId) {
    if (sellPrice === null) sellPrice = 0;
    if (costItems === null) costItems = [];
  }

  return {
    sellPrice,
    quantity: raw?.quantity ?? 0,
    dealerId,
    channel: dealer?.name || channel,
    costItems,
  };
}

function normalizeBatch(
  raw: Partial<Batch> & Record<string, unknown>,
  dealers: Dealer[],
  legacySnapshot: boolean,
): Batch {
  const overrides = normalizeCommercialOverrides(raw);
  // Alte Daten hatten immer eine Zahl → als Override behalten.
  // Neue Seeds / explizit null → erben vom Produkt.
  let unitPurchasePrice: number | null;
  if ("unitPurchasePrice" in raw && raw.unitPurchasePrice === null) {
    unitPurchasePrice = null;
  } else if (typeof raw.unitPurchasePrice === "number") {
    unitPurchasePrice = raw.unitPurchasePrice;
  } else {
    unitPurchasePrice = legacySnapshot ? 0 : null;
  }

  return {
    id: raw.id || createId("bat"),
    productId: raw.productId || "",
    supplierId: raw.supplierId || "",
    label: raw.label || "",
    quantity: raw.quantity ?? 0,
    unitPurchasePrice,
    ...overrides,
    costItems: Array.isArray(raw.costItems) ? raw.costItems : [],
    sales: normalizeSales(raw.sales, dealers, legacySnapshot),
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function isOverheadPeriod(value: unknown): value is OverheadPeriod {
  return (
    typeof value === "string" &&
    (OVERHEAD_PERIODS as string[]).includes(value)
  );
}

function isOverheadCategory(value: unknown): value is OverheadCategory {
  return (
    typeof value === "string" &&
    (OVERHEAD_CATEGORIES as string[]).includes(value)
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
    kategorie: isOverheadCategory(raw.kategorie) ? raw.kategorie : "sonstige",
    verteilschluessel,
    manuelleAufteilung,
    createdAt: raw.createdAt || new Date().toISOString(),
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

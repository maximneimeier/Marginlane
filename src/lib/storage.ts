import type {
  AppData,
  Batch,
  CostItem,
  Dealer,
  DealerChannel,
  PaymentUnit,
  PricingUnit,
  Product,
  SalesData,
  Supplier,
} from "./types";
import { EMPTY_DATA, formatPaymentTerms, isPricingUnit } from "./types";
import { createId } from "./format";
import { emptyCommercialOverrides } from "./resolve";

const STORAGE_KEY = "landed-cost-v7";
const LEGACY_STORAGE_KEYS = ["landed-cost-v6"];

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

function readStoredJson(): { parsed: AppData; legacy: boolean } | null {
  if (typeof window === "undefined") return null;
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) {
    return { parsed: { ...EMPTY_DATA, ...JSON.parse(current) } as AppData, legacy: false };
  }
  for (const key of LEGACY_STORAGE_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy) {
      return {
        parsed: { ...EMPTY_DATA, ...JSON.parse(legacy) } as AppData,
        legacy: true,
      };
    }
  }
  return null;
}

export function loadData(): AppData {
  if (typeof window === "undefined") return EMPTY_DATA;
  try {
    const stored = readStoredJson();
    if (!stored) return seedDemoData();
    const { parsed, legacy } = stored;
    const dealers = (parsed.dealers || []).map((d) => normalizeDealer(d));
    const products = (parsed.products || []).map((p) =>
      normalizeProduct(p as Product & Record<string, unknown>),
    );
    const batches = (parsed.batches || []).map((b) =>
      normalizeBatch(b as Batch & Record<string, unknown>, dealers, legacy),
    );
    const next: AppData = {
      ...parsed,
      suppliers: (parsed.suppliers || []).map((s) =>
        normalizeSupplier(s as Supplier & { contact?: string }),
      ),
      dealers,
      products,
      batches,
    };
    saveData(next);
    return next;
  } catch {
    return EMPTY_DATA;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function seedDemoData(): AppData {
  const mocks: Partial<Supplier>[] = [
    {
      name: "Shenzhen Parts Co.",
      country: "CN",
      contactName: "Li Wei",
      email: "li@shenzhen-parts.cn",
      phone: "+86 755 1234 5678",
      currency: "USD",
      paymentDays: 30,
      incoterm: "FOB",
      originPort: "Yantian / Shenzhen",
      leadTimeDays: 35,
      status: "active",
      taxId: "91440300MA5FXXXX",
    },
    {
      name: "Nordic Components AB",
      country: "SE",
      contactName: "Anna Bergström",
      email: "orders@nordic-comp.se",
      phone: "+46 8 123 456",
      currency: "EUR",
      paymentDays: 30,
      skontoPercent: 2,
      skontoDays: 10,
      incoterm: "DDP",
      leadTimeDays: 14,
      status: "active",
      taxId: "SE556677889901",
    },
    {
      name: "Vietnam Precision Ltd.",
      country: "VN",
      contactName: "Nguyen Tran",
      email: "sales@vn-precision.vn",
      phone: "+84 28 3822 1100",
      currency: "USD",
      paymentDays: 45,
      incoterm: "FOB",
      originPort: "Cat Lai / Ho Chi Minh",
      leadTimeDays: 40,
      status: "active",
      certifications: "ISO 9001, BSCI",
    },
    {
      name: "Gujarat Electronics Pvt.",
      country: "IN",
      contactName: "Priya Sharma",
      email: "priya@gujarat-elec.in",
      currency: "USD",
      paymentDays: 60,
      incoterm: "CIF",
      originPort: "Mundra",
      leadTimeDays: 50,
      status: "review",
      legalForm: "Pvt. Ltd.",
    },
    {
      name: "Rotterdam Trade Hub B.V.",
      country: "NL",
      contactName: "Joris de Vries",
      email: "joris@rthub.nl",
      currency: "EUR",
      paymentDays: 14,
      skontoPercent: 1.5,
      skontoDays: 7,
      incoterm: "DAP",
      leadTimeDays: 5,
      status: "active",
      taxId: "NL123456789B01",
    },
    {
      name: "Osaka Metal Works",
      country: "JP",
      contactName: "Yuki Tanaka",
      email: "y.tanaka@osaka-metal.jp",
      currency: "JPY",
      paymentDays: 30,
      incoterm: "EXW",
      originPort: "Osaka",
      leadTimeDays: 28,
      status: "active",
      certifications: "ISO 14001",
    },
    {
      name: "Istanbul Softgoods A.Ş.",
      country: "TR",
      contactName: "Elif Yılmaz",
      email: "elif@ist-softgoods.tr",
      currency: "EUR",
      paymentDays: 45,
      incoterm: "CIP",
      originPort: "Ambarli",
      leadTimeDays: 21,
      status: "inactive",
      notes: "Pause bis Q3 wegen Kapazität",
    },
    {
      name: "Porto Packaging Lda.",
      country: "PT",
      contactName: "Miguel Costa",
      email: "miguel@porto-pack.pt",
      currency: "EUR",
      paymentDays: 21,
      skontoPercent: 3,
      skontoDays: 10,
      incoterm: "DDP",
      leadTimeDays: 10,
      status: "active",
      taxId: "PT501234567",
    },
    {
      name: "Taipei Connect Co.",
      country: "TW",
      contactName: "Chen Ming",
      email: "chen@taipei-connect.tw",
      currency: "USD",
      paymentDays: 30,
      incoterm: "FOB",
      originPort: "Keelung",
      leadTimeDays: 32,
      status: "active",
      legalForm: "Co., Ltd.",
      certifications: "UL, RoHS",
    },
  ];

  const suppliers = mocks.map((m, i) =>
    normalizeSupplier({
      ...m,
      id: createId("sup"),
      createdAt: daysAgo(90 - i * 7),
    }),
  );

  const [s1, s2, s3, s4, s5, s6, s7, s8, s9] = suppliers;

  const products: Product[] = [
    // Shenzhen — 3 Produkte
    {
      id: createId("prd"),
      supplierId: s1.id,
      name: "USB-C Hub 7-in-1",
      sku: "HUB-7IN1",
      unitPrice: 8.5,
      moq: 500,
      discountTiers: [
        { minQty: 1000, discountPercent: 5 },
        { minQty: 2500, discountPercent: 12 },
      ],
      createdAt: daysAgo(80),
    },
    {
      id: createId("prd"),
      supplierId: s1.id,
      name: "USB-C Dock Dual Monitor",
      sku: "DOCK-DM-02",
      unitPrice: 22.4,
      moq: 300,
      discountTiers: [{ minQty: 800, discountPercent: 7 }],
      createdAt: daysAgo(72),
    },
    {
      id: createId("prd"),
      supplierId: s1.id,
      name: "GaN Charger 65W",
      sku: "CHG-GAN-65",
      unitPrice: 9.8,
      moq: 500,
      discountTiers: [{ minQty: 2000, discountPercent: 9 }],
      createdAt: daysAgo(65),
    },
    // Nordic — 2 Produkte
    {
      id: createId("prd"),
      supplierId: s2.id,
      name: "USB-C Hub 7-in-1",
      sku: "HUB-7IN1",
      unitPrice: 11.2,
      moq: 200,
      discountTiers: [{ minQty: 500, discountPercent: 8 }],
      createdAt: daysAgo(70),
    },
    {
      id: createId("prd"),
      supplierId: s2.id,
      name: "Wireless Keyboard Compact",
      sku: "KB-WL-C01",
      unitPrice: 18.5,
      moq: 150,
      discountTiers: [{ minQty: 400, discountPercent: 6 }],
      createdAt: daysAgo(48),
    },
    // Vietnam — 3 Produkte
    {
      id: createId("prd"),
      supplierId: s3.id,
      name: "Silicone Case MagSafe",
      sku: "CASE-MS-01",
      unitPrice: 2.4,
      moq: 1000,
      discountTiers: [{ minQty: 5000, discountPercent: 10 }],
      createdAt: daysAgo(55),
    },
    {
      id: createId("prd"),
      supplierId: s3.id,
      name: "Screen Protector 2-Pack",
      sku: "PROT-GLS-2",
      unitPrice: 0.85,
      moq: 2000,
      discountTiers: [{ minQty: 10000, discountPercent: 12 }],
      createdAt: daysAgo(50),
    },
    {
      id: createId("prd"),
      supplierId: s3.id,
      name: "Cable Organizer Set",
      sku: "ORG-CBL-S",
      unitPrice: 1.35,
      moq: 1500,
      discountTiers: [],
      createdAt: daysAgo(42),
    },
    // Gujarat — 1
    {
      id: createId("prd"),
      supplierId: s4.id,
      name: "LED Desk Lamp",
      sku: "LAMP-LED-12",
      unitPrice: 14.8,
      moq: 300,
      discountTiers: [],
      createdAt: daysAgo(40),
    },
    // Rotterdam — 2
    {
      id: createId("prd"),
      supplierId: s5.id,
      name: "EU Power Adapter",
      sku: "PWR-EU-20W",
      unitPrice: 3.9,
      moq: 500,
      discountTiers: [{ minQty: 2000, discountPercent: 6 }],
      createdAt: daysAgo(30),
    },
    {
      id: createId("prd"),
      supplierId: s5.id,
      name: "Travel Plug Kit EU/UK/US",
      sku: "PLUG-TRV-3",
      unitPrice: 4.2,
      moq: 400,
      discountTiers: [{ minQty: 1200, discountPercent: 5 }],
      createdAt: daysAgo(25),
    },
    // Osaka — 2
    {
      id: createId("prd"),
      supplierId: s6.id,
      name: "Aluminium Stand Laptop",
      sku: "STND-ALU-L",
      unitPrice: 16.9,
      moq: 200,
      discountTiers: [{ minQty: 600, discountPercent: 8 }],
      createdAt: daysAgo(38),
    },
    {
      id: createId("prd"),
      supplierId: s6.id,
      name: "Precision Screwdriver Set",
      sku: "TOOL-SCR-24",
      unitPrice: 7.4,
      moq: 250,
      discountTiers: [],
      createdAt: daysAgo(33),
    },
    // Istanbul — 1 (inactive supplier)
    {
      id: createId("prd"),
      supplierId: s7.id,
      name: "Organic Cotton Twill",
      sku: "FAB-COT-TW",
      /** Demo: Meterware — Preis pro Meter × Meter */
      unitPrice: 4.2,
      moq: 50,
      discountTiers: [{ minQty: 200, discountPercent: 8 }],
      pricingUnit: "m" as const,
      createdAt: daysAgo(60),
    },
    // Porto — 2
    {
      id: createId("prd"),
      supplierId: s8.id,
      name: "Corrugated Mailer Box",
      sku: "BOX-M-S",
      unitPrice: 0.42,
      moq: 2000,
      discountTiers: [],
      createdAt: daysAgo(20),
    },
    {
      id: createId("prd"),
      supplierId: s8.id,
      name: "Tissue Wrap Sheets",
      sku: "WRAP-TIS-50",
      /** Demo: Preis pro Gramm × Gramm (nicht Stück) */
      unitPrice: 0.0016,
      moq: 5000,
      discountTiers: [{ minQty: 20000, discountPercent: 15 }],
      pricingUnit: "g" as const,
      createdAt: daysAgo(16),
    },
    // Taipei — 3
    {
      id: createId("prd"),
      supplierId: s9.id,
      name: "USB-C Cable 2m",
      sku: "CBL-USC-2M",
      unitPrice: 1.15,
      moq: 1000,
      discountTiers: [{ minQty: 5000, discountPercent: 8 }],
      createdAt: daysAgo(12),
    },
    {
      id: createId("prd"),
      supplierId: s9.id,
      name: "HDMI 2.1 Cable 1.5m",
      sku: "CBL-HDMI-15",
      unitPrice: 2.6,
      moq: 800,
      discountTiers: [{ minQty: 3000, discountPercent: 7 }],
      createdAt: daysAgo(10),
    },
    {
      id: createId("prd"),
      supplierId: s9.id,
      name: "USB Hub 4-Port",
      sku: "HUB-4P-USB",
      unitPrice: 4.8,
      moq: 600,
      discountTiers: [],
      createdAt: daysAgo(8),
    },
  ].map((p) => normalizeProduct(p));

  const dAmazon = normalizeDealer({
    name: "Amazon DE",
    country: "DE",
    contactName: "Seller Support",
    email: "seller-de@amazon.de",
    channel: "marketplace",
    paymentTerms: "Netto Plattform · Auszahlung 14 Tage",
    defaultSellPrice: 29.9,
    salesCostItems: [
      cost("Plattformgebühr", 15, "percent_of_goods", "vertrieb", "Amazon Referral Fee"),
      cost("Zahlungsgebühr", 1.9, "percent_of_goods", "vertrieb"),
      cost("Fulfillment", 2.4, "per_unit", "vertrieb", "FBA"),
    ],
    status: "active",
    notes: "FBA / Marketplace — Gebühren je Kategorie leicht abweichend.",
  });
  const dShop = normalizeDealer({
    name: "Eigenmarke Shop",
    country: "DE",
    contactName: "Lisa Hoffmann",
    email: "orders@eigenmarke.shop",
    phone: "+49 30 445566",
    channel: "online",
    paymentTerms: "Sofort (Shopify Payments)",
    defaultSellPrice: 12.99,
    salesCostItems: [
      cost("Zahlungsgebühr", 2.1, "percent_of_goods", "vertrieb", "Shopify Payments"),
      cost("Versand outbound", 1.8, "per_unit", "vertrieb"),
      cost("Marketing / CAC", 1.2, "per_unit", "vertrieb", "Ads anteilig"),
    ],
    status: "active",
    notes: "Eigener D2C-Shop.",
  });
  const dMedia = normalizeDealer({
    name: "MediaMarkt Saturn",
    country: "DE",
    contactName: "Einkauf Elektronik",
    email: "einkauf@mediamarkt.de",
    phone: "+49 89 123456",
    channel: "retail",
    paymentTerms: "45 Tage",
    defaultSellPrice: 9.9,
    salesCostItems: [
      cost("Provision", 8, "percent_of_goods", "vertrieb", "Handelsmarge Retail"),
      cost("Listungsgebühr", 0.35, "per_unit", "vertrieb"),
    ],
    status: "active",
    notes: "Zentrale Listung DE/AT.",
  });
  const dOtto = normalizeDealer({
    name: "Otto Marktplatz",
    country: "DE",
    contactName: "Partner Management",
    email: "partners@otto.de",
    channel: "marketplace",
    paymentTerms: "Netto Plattform · 30 Tage",
    defaultSellPrice: 24.99,
    salesCostItems: [
      cost("Plattformgebühr", 12, "percent_of_goods", "vertrieb", "Otto Provision"),
      cost("Zahlungsgebühr", 1.5, "percent_of_goods", "vertrieb"),
      cost("Versand outbound", 2.1, "per_unit", "vertrieb", "Partnerversand"),
    ],
    status: "active",
  });
  const dFach = normalizeDealer({
    name: "Nordwest Fachhandel GmbH",
    country: "DE",
    contactName: "Thomas Keller",
    email: "t.keller@nordwest-fh.de",
    phone: "+49 40 998877",
    channel: "b2b",
    paymentTerms: "30 Tage · 2% Skonto bei 10 Tagen",
    defaultSellPrice: 18.5,
    salesCostItems: [
      cost("Provision", 5, "percent_of_goods", "vertrieb", "Außendienst"),
      cost("Handling", 0.4, "per_unit", "vertrieb", "Kommissionierung"),
    ],
    status: "active",
    notes: "Regionaler Fachhändler Norddeutschland.",
  });
  const dZalando = normalizeDealer({
    name: "Zalando Partner",
    country: "DE",
    contactName: "Partner Success",
    email: "partners@zalando.de",
    channel: "marketplace",
    paymentTerms: "Netto Plattform",
    defaultSellPrice: 39.95,
    salesCostItems: [
      cost("Plattformgebühr", 18, "percent_of_goods", "vertrieb", "Zalando Commission"),
      cost("Fulfillment", 2.9, "per_unit", "vertrieb", "ZFS"),
    ],
    status: "active",
  });
  const dHornbach = normalizeDealer({
    name: "Hornbach Baumarkt",
    country: "DE",
    contactName: "Sortimentsmanagement",
    email: "einkauf@hornbach.de",
    phone: "+49 6341 6000",
    channel: "retail",
    paymentTerms: "60 Tage",
    defaultSellPrice: 14.99,
    salesCostItems: [
      cost("Provision", 10, "percent_of_goods", "vertrieb", "Handelsrabatt"),
      cost("Listungsgebühr", 450, "lump_sum", "vertrieb", "Slotting Fee pauschal"),
    ],
    status: "active",
  });
  const dConrad = normalizeDealer({
    name: "Conrad Electronic",
    country: "DE",
    contactName: "B2B Einkauf",
    email: "b2b@conrad.de",
    channel: "b2b",
    paymentTerms: "30 Tage",
    defaultSellPrice: 22.0,
    salesCostItems: [
      cost("Provision", 6, "percent_of_goods", "vertrieb"),
      cost("Zahlungsgebühr", 1.2, "percent_of_goods", "vertrieb"),
    ],
    status: "active",
  });

  const dealers: Dealer[] = [
    dAmazon,
    dShop,
    dMedia,
    dOtto,
    dFach,
    dZalando,
    dHornbach,
    dConrad,
  ];

  // Demo: meiste Felder null = erben; einzelne Overrides zeigen Abweichung.
  const batches: Batch[] = [
    {
      id: createId("bat"),
      productId: products[0].id,
      supplierId: s1.id,
      label: "PO-2026-014",
      quantity: 1000,
      unitPurchasePrice: null,
      ...emptyCommercialOverrides(),
      costItems: [
        cost("Fracht", 420, "lump_sum", "transport"),
        cost("Zoll", 6.5, "percent_of_goods", "einkauf"),
        cost("QC / Inspection", 180, "lump_sum", "einkauf"),
        cost("Versicherung", 0.8, "percent_of_goods", "transport"),
      ],
      sales: {
        sellPrice: null,
        quantity: 1000,
        dealerId: dAmazon.id,
        channel: dAmazon.name,
        costItems: null,
      },
      createdAt: daysAgo(18),
    },
    {
      id: createId("bat"),
      productId: products[1].id,
      supplierId: s1.id,
      label: "PO-2026-019",
      quantity: 400,
      unitPurchasePrice: 21.5,
      ...emptyCommercialOverrides(),
      costItems: [
        cost("Fracht", 310, "lump_sum", "transport"),
        cost("Zoll", 5.5, "percent_of_goods", "einkauf"),
      ],
      sales: {
        sellPrice: 69.9,
        quantity: 400,
        dealerId: dAmazon.id,
        channel: dAmazon.name,
        costItems: [
          cost("Plattformgebühr", 15, "percent_of_goods", "vertrieb"),
          cost("Fulfillment", 3.1, "per_unit", "vertrieb", "FBA"),
        ],
      },
      createdAt: daysAgo(11),
    },
    {
      id: createId("bat"),
      productId: products[5].id,
      supplierId: s3.id,
      label: "PO-2026-022",
      quantity: 2500,
      unitPurchasePrice: null,
      ...emptyCommercialOverrides(),
      costItems: [
        cost("Fracht", 680, "lump_sum", "transport"),
        cost("Zoll", 4.2, "percent_of_goods", "einkauf"),
      ],
      sales: {
        sellPrice: null,
        quantity: 2500,
        dealerId: dShop.id,
        channel: dShop.name,
        costItems: null,
      },
      createdAt: daysAgo(9),
    },
    {
      id: createId("bat"),
      productId: products[6].id,
      supplierId: s3.id,
      label: "PO-2026-028",
      quantity: 5000,
      unitPurchasePrice: null,
      ...emptyCommercialOverrides(),
      costItems: [cost("Fracht", 240, "lump_sum", "transport")],
      sales: {
        sellPrice: 6.99,
        quantity: 5000,
        dealerId: dShop.id,
        channel: dShop.name,
        costItems: null,
      },
      createdAt: daysAgo(6),
    },
    {
      id: createId("bat"),
      productId: products[9].id,
      supplierId: s5.id,
      label: "PO-2026-031",
      quantity: 800,
      unitPurchasePrice: null,
      ...emptyCommercialOverrides(),
      costItems: [cost("Fracht", 95, "lump_sum", "transport")],
      sales: {
        sellPrice: null,
        quantity: 800,
        dealerId: dMedia.id,
        channel: dMedia.name,
        costItems: null,
      },
      createdAt: daysAgo(4),
    },
    {
      id: createId("bat"),
      productId: products[16].id,
      supplierId: s9.id,
      label: "PO-2026-035",
      quantity: 2000,
      unitPurchasePrice: null,
      ...emptyCommercialOverrides(),
      costItems: [
        cost("Fracht", 190, "lump_sum", "transport"),
        cost("Zoll", 3.0, "percent_of_goods", "einkauf"),
      ],
      sales: {
        sellPrice: 7.99,
        quantity: 2000,
        dealerId: dAmazon.id,
        channel: dAmazon.name,
        costItems: [
          cost("Plattformgebühr", 12, "percent_of_goods", "vertrieb"),
          cost("Fulfillment", 1.6, "per_unit", "vertrieb"),
        ],
      },
      createdAt: daysAgo(2),
    },
  ];

  const data: AppData = { suppliers, products, dealers, batches };
  saveData(data);
  return data;
}

export { normalizeSupplier, normalizeDealer, normalizeProduct, normalizeBatch };

export type CostAllocation = "per_unit" | "lump_sum" | "percent_of_goods";
export type CostPhase = "einkauf" | "transport" | "lager" | "vertrieb";
export type SupplierStatus = "active" | "inactive" | "review";
export type PaymentUnit = "Tage" | "Wochen";

/**
 * Preisenheit für Product.unitPrice und Batch.quantity.
 * Kalkulation bleibt immer quantity × unit_price — die Einheit ist nur Semantik.
 */
export type PricingUnit = "pcs" | "g" | "kg" | "ml" | "l" | "m";

export const PRICING_UNITS: PricingUnit[] = [
  "pcs",
  "g",
  "kg",
  "ml",
  "l",
  "m",
];

export function isPricingUnit(value: unknown): value is PricingUnit {
  return (
    typeof value === "string" &&
    (PRICING_UNITS as string[]).includes(value)
  );
}

export type CostItem = {
  id: string;
  type: string;
  label: string;
  amount: number;
  allocation: CostAllocation;
  phase: CostPhase;
};

export type DiscountTier = {
  minQty: number;
  discountPercent: number;
};

/** Kommerzielle Defaults auf Supplier-Ebene */
export type CommercialTerms = {
  currency: string;
  paymentDays: number;
  paymentUnit: PaymentUnit;
  skontoPercent: number;
  skontoDays: number;
  incoterm: string;
};

/**
 * Nullable Overrides — `null` = vom Parent erben (Supplier → Product → Batch).
 * Nie den Parent-Wert beim Anlegen kopieren.
 */
export type CommercialOverrides = {
  currency: string | null;
  paymentDays: number | null;
  paymentUnit: PaymentUnit | null;
  skontoPercent: number | null;
  skontoDays: number | null;
  incoterm: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  country: string;
  contactName: string;
  email: string;
  phone: string;
  currency: string;
  paymentDays: number;
  paymentUnit: PaymentUnit;
  skontoPercent: number;
  skontoDays: number;
  incoterm: string;
  taxId: string;
  legalForm: string;
  website: string;
  originPort: string;
  leadTimeDays: number;
  iban: string;
  certifications: string;
  status: SupplierStatus;
  notes: string;
  /** Abgeleitete Anzeige, z. B. „30 Tage · 2% Skonto“ */
  paymentTerms: string;
  createdAt: string;
};

export type Product = {
  id: string;
  supplierId: string;
  name: string;
  sku: string;
  /**
   * Listenpreis **pro `pricingUnit`** (z. B. €/g oder €/Stk.).
   * Charge-Menge und Staffeln sind in derselben Einheit.
   */
  unitPrice: number;
  /** Mindestabnahme in `pricingUnit` */
  moq: number;
  discountTiers: DiscountTier[];
  /** Einheit für Preis, Menge, MOQ und Staffeln */
  pricingUnit: PricingUnit;
  /** Overrides der Supplier-Konditionen (`null` = erben) */
  currency: string | null;
  paymentDays: number | null;
  paymentUnit: PaymentUnit | null;
  skontoPercent: number | null;
  skontoDays: number | null;
  incoterm: string | null;
  createdAt: string;
};

/**
 * Spec-ER: Batch 1 — 1 SalesData.
 * Verkaufspreis, Menge, Kanal und Vertriebskosten sitzen hier —
 * nicht am Händler. Händler (`dealerId`) ist optionale Vorlage außerhalb
 * der Kernkette und liefert Defaults nur solange Felder `null` sind.
 */
export type SalesData = {
  /**
   * Verkaufspreis pro Preisenheit.
   * `null` = optional vom verknüpften Händler erben (nur wenn dealerId gesetzt).
   */
  sellPrice: number | null;
  /** Verkaufsmenge (typisch = Batch.quantity) */
  quantity: number;
  /** Verkaufskanal / Label (Spec-Feld; kann Händlername sein) */
  channel: string;
  /**
   * Optionaler Verweis auf Händler-Stammdaten (Vorlage).
   * `null` = reine SalesData ohne Stammdaten-Kopplung.
   */
  dealerId: string | null;
  /**
   * Vertriebskosten der Charge.
   * `null` = optional vom Händler erben; Array (auch leer) = Charge-Werte.
   */
  costItems: CostItem[] | null;
};

/**
 * Optionale Stammdaten-Vorlage außerhalb des Spec-Kern-ER
 * (Supplier → Product → Batch → SalesData).
 * Füllt SalesData-Defaults per Inheritance, speichert sie aber nicht.
 */
export type DealerStatus = "active" | "inactive";

export type DealerChannel =
  | "b2b"
  | "retail"
  | "marketplace"
  | "online"
  | "other";

export type Dealer = {
  id: string;
  name: string;
  country: string;
  contactName: string;
  email: string;
  phone: string;
  channel: DealerChannel;
  paymentTerms: string;
  /** Vorlage: Standard-VK für SalesData (wenn sellPrice null) */
  defaultSellPrice: number;
  /** Vorlage: Standard-Vertriebskosten (wenn costItems null) */
  salesCostItems: CostItem[];
  status: DealerStatus;
  notes: string;
  createdAt: string;
};

export type Batch = {
  id: string;
  productId: string;
  supplierId: string;
  label: string;
  /**
   * Menge in `Product.pricingUnit` (Stück, Gramm, Meter, …).
   * Unit Economics = quantity × unit_price in derselben Einheit.
   */
  quantity: number;
  /**
   * `null` = EK aus Produktlistenpreis + Staffel zur Menge.
   * Zahl = Charge-Override.
   */
  unitPurchasePrice: number | null;
  /** Overrides der Product/Supplier-Konditionen (`null` = erben) */
  currency: string | null;
  paymentDays: number | null;
  paymentUnit: PaymentUnit | null;
  skontoPercent: number | null;
  skontoDays: number | null;
  incoterm: string | null;
  costItems: CostItem[];
  /**
   * Spec: genau eine Verkaufsseite pro Charge (1—1).
   * Händler nur optional über sales.dealerId.
   */
  sales: SalesData;
  createdAt: string;
};

export type AppData = {
  suppliers: Supplier[];
  products: Product[];
  dealers: Dealer[];
  batches: Batch[];
};

export const COST_TYPE_PRESETS = [
  "Fracht",
  "Zoll",
  "QC / Inspection",
  "Verpackung",
  "Lager",
  "Versicherung",
  "Handling",
  "Wechselkursverlust",
  "Provision",
  "Marketing / CAC",
  "Plattformgebühr",
  "Zahlungsgebühr",
  "Sonstiges",
] as const;

export const PHASE_LABELS: Record<CostPhase, string> = {
  einkauf: "Einkauf",
  transport: "Transport",
  lager: "Lager",
  vertrieb: "Vertrieb",
};

export const ALLOCATION_LABELS: Record<CostAllocation, string> = {
  per_unit: "pro Einheit",
  lump_sum: "pauschal",
  percent_of_goods: "% vom Warenwert",
};

export const PROCUREMENT_PHASES: CostPhase[] = ["einkauf", "transport", "lager"];
export const SALES_PHASES: CostPhase[] = ["vertrieb"];

export const CURRENCIES = ["EUR", "USD", "CNY", "GBP", "CHF", "JPY", "HKD"] as const;

export const INCOTERMS = [
  "EXW",
  "FCA",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
] as const;

export const LEGAL_FORMS = [
  "",
  "GmbH",
  "AG",
  "UG",
  "Ltd",
  "Inc",
  "Co., Ltd.",
  "Sole Proprietor",
  "Partnership",
  "Andere",
] as const;

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
  review: "In Prüfung",
};

export const DEALER_STATUS_LABELS: Record<DealerStatus, string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
};

export const DEALER_CHANNEL_LABELS: Record<DealerChannel, string> = {
  b2b: "B2B / Fachhandel",
  retail: "Retail",
  marketplace: "Marketplace",
  online: "Online / D2C",
  other: "Sonstiges",
};

export const COUNTRIES = [
  { code: "CN", name: "China" },
  { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" },
  { code: "CH", name: "Schweiz" },
  { code: "NL", name: "Niederlande" },
  { code: "BE", name: "Belgien" },
  { code: "FR", name: "Frankreich" },
  { code: "IT", name: "Italien" },
  { code: "ES", name: "Spanien" },
  { code: "PL", name: "Polen" },
  { code: "CZ", name: "Tschechien" },
  { code: "SE", name: "Schweden" },
  { code: "DK", name: "Dänemark" },
  { code: "NO", name: "Norwegen" },
  { code: "FI", name: "Finnland" },
  { code: "GB", name: "Vereinigtes Königreich" },
  { code: "IE", name: "Irland" },
  { code: "US", name: "USA" },
  { code: "CA", name: "Kanada" },
  { code: "MX", name: "Mexiko" },
  { code: "BR", name: "Brasilien" },
  { code: "IN", name: "Indien" },
  { code: "VN", name: "Vietnam" },
  { code: "TH", name: "Thailand" },
  { code: "MY", name: "Malaysia" },
  { code: "ID", name: "Indonesien" },
  { code: "TW", name: "Taiwan" },
  { code: "KR", name: "Südkorea" },
  { code: "JP", name: "Japan" },
  { code: "HK", name: "Hongkong" },
  { code: "SG", name: "Singapur" },
  { code: "AU", name: "Australien" },
  { code: "TR", name: "Türkei" },
  { code: "AE", name: "VAE" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Rumänien" },
  { code: "HU", name: "Ungarn" },
] as const;

export const EMPTY_DATA: AppData = {
  suppliers: [],
  products: [],
  dealers: [],
  batches: [],
};

export function formatPaymentTerms(s: {
  paymentDays: number;
  paymentUnit: PaymentUnit;
  skontoPercent: number;
  skontoDays: number;
}): string {
  const base = `${s.paymentDays} ${s.paymentUnit}`;
  if (s.skontoPercent > 0 && s.skontoDays > 0) {
    return `${base} · ${s.skontoPercent}% Skonto bei ${s.skontoDays} Tagen`;
  }
  return base;
}

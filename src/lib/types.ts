export type CostAllocation = "per_unit" | "lump_sum" | "percent_of_goods";
export type CostPhase = "einkauf" | "transport" | "lager" | "vertrieb";
export type SupplierStatus = "active" | "inactive" | "review";
export type PaymentUnit = "Tage" | "Wochen";

/**
 * Preisenheit für Mengen und Preise.
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
 * Nullable Overrides — `null` = vom Parent erben (Supplier → Batch).
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

/**
 * @deprecated Alte Beschaffungs-Entität (vor BOM-Komponenten).
 * Nach Migration leer; nur noch für Typ-Kompat / Legacy-Imports.
 */
export type Product = {
  id: string;
  supplierId: string;
  name: string;
  sku: string;
  /** @deprecated Einkaufspreis — ersetzt durch Component.purchasePricePerUnit */
  unitPrice: number;
  moq: number;
  discountTiers: DiscountTier[];
  pricingUnit: PricingUnit;
  currency: string | null;
  paymentDays: number | null;
  paymentUnit: PaymentUnit | null;
  skontoPercent: number | null;
  skontoDays: number | null;
  incoterm: string | null;
  createdAt: string;
};

/** Verkaufsprodukt (Katalog) — was das Unternehmen verkauft */
export type CatalogProductStatus = "active" | "inactive";

/** Max. Anzahl verknüpfter Dokumente pro Katalogprodukt */
export const MAX_PRODUCT_DOCUMENTS = 3;

/** Referenz / Link zu einem Produkt-Dokument (kein Datei-Upload) */
export type ProductDocument = {
  id: string;
  title: string;
  /** Externer Link (URL); leer = nur Titel/Notiz */
  url: string;
  notes: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  /**
   * Optionaler Listen-/Katalogpreis (MSRP).
   * Operativer Verkaufspreis sitzt auf Sale, nicht hier.
   */
  listPrice: number | null;
  pricingUnit: PricingUnit;
  currency: string;
  status: CatalogProductStatus;
  category: string;
  /** Optional Zielmarge in Prozent (z. B. 35 = 35%) */
  targetMarginPercent: number | null;
  notes: string;
  /** Bis zu {@link MAX_PRODUCT_DOCUMENTS} Dokument-Referenzen */
  documents: ProductDocument[];
  createdAt: string;
};

/**
 * Geplante Absatzmenge: Produkt × Händler × Kalendermonat × Szenario.
 * `dealerId: null` = Direktverkauf / ohne Händler.
 */
export type SalesPlanScenario = "base" | "upside" | "downside";

export type SalesPlanCell = {
  productId: string;
  /** null = Direkt / ohne Händler */
  dealerId: string | null;
  /** Kalendermonat YYYY-MM */
  month: string;
  /** Geplante Stückzahl in Preisenheit des Produkts */
  quantity: number;
  scenario: SalesPlanScenario;
};

/** Plan-VK und Annahme je Produkt × Händler × Szenario */
export type SalesPlanRowMeta = {
  productId: string;
  dealerId: string | null;
  scenario: SalesPlanScenario;
  /** Plan-Verkaufspreis / Einheit; null = Fallback Listenpreis / Händler-Default */
  unitPrice: number | null;
  note: string;
};

export type SalesPlanSettings = {
  activeScenario: SalesPlanScenario;
  /** Freigegebene Pläne als `${year}:${scenario}` */
  frozen: string[];
};

export const SALES_PLAN_SCENARIOS: SalesPlanScenario[] = [
  "base",
  "upside",
  "downside",
];

export const EMPTY_SALES_PLAN_SETTINGS: SalesPlanSettings = {
  activeScenario: "base",
  frozen: [],
};

/**
 * Stammdatensatz: wiederverwendbare Beschaffungs-Komponente (ohne Produktbezug).
 * Zuordnung zu Produkten über `ProductComponent`.
 */
export type Component = {
  id: string;
  /** "" = kein Lieferant */
  supplierId: string;
  name: string;
  /** Optionale Artikelnummer beim Lieferanten (unabhängig von Produkt-SKU) */
  sku: string;
  /**
   * Währung des Einkaufspreises.
   * `null` = vom verknüpften Lieferanten erben.
   * Ohne Lieferant: explizite Währung (Default Workspace/EUR).
   */
  currency: string | null;
  purchasePricePerUnit: number;
  /** Freitext, z. B. Verpackungseinheiten beim Lieferanten */
  notes: string;
};

/**
 * n:m-Verknüpfung Katalogprodukt ↔ Komponenten-Stamm.
 * Menge und optionaler Sonderpreis gelten nur für dieses Produkt.
 */
export type ProductComponent = {
  id: string;
  productId: string;
  componentId: string;
  quantityPerProductUnit: number;
  /** null = Standard-EK der Component */
  purchasePriceOverride: number | null;
};

/**
 * @deprecated Einzelnes SalesData-Objekt (vor Multi-Sale).
 * Wird bei Migration in Sale[] umgewandelt.
 */
export type SalesData = {
  sellPrice: number | null;
  quantity: number;
  channel: string;
  dealerId: string | null;
  costItems: CostItem[] | null;
};

/** Verkaufseintrag einer Charge — mehrere pro Batch möglich */
export type Sale = {
  id: string;
  dealerId: string | null;
  salePricePerUnit: number | null;
  quantity: number;
  /** Verkaufskanal / Label */
  channel: string;
  /** Provision, CAC, etc. — null = optional vom Händler erben */
  costItems: CostItem[] | null;
};

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
  /** Standard-Zahlungsziel (Freitext, analog Supplier.paymentTerms) */
  paymentTerms: string;
  /** Standard-Währung */
  currency: string;
  /** Vorlage: Standard-VK für Sale (wenn salePricePerUnit null) */
  defaultSellPrice: number;
  /** Vorlage: Standard-Vertriebskosten (wenn costItems null) */
  salesCostItems: CostItem[];
  status: DealerStatus;
  notes: string;
  createdAt: string;
};

export type Batch = {
  id: string;
  /** Verweis auf CatalogProduct */
  productId: string;
  supplierId: string;
  label: string;
  /**
   * Menge in CatalogProduct.pricingUnit.
   */
  quantity: number;
  /**
   * `null` = EK aus BOM-Komponenten-Summe.
   * Zahl = Charge-Override.
   */
  unitPurchasePrice: number | null;
  currency: string | null;
  paymentDays: number | null;
  paymentUnit: PaymentUnit | null;
  skontoPercent: number | null;
  skontoDays: number | null;
  incoterm: string | null;
  costItems: CostItem[];
  /** Mehrere Verkäufe an unterschiedliche Dealer/Preise */
  sales: Sale[];
  createdAt: string;
};

/** Wiederkehrende Gemeinkosten-Position (Unternehmensoverhead) */
export type OverheadPeriod = "monatlich" | "quartalsweise" | "jaehrlich";
/** Klassische Gemeinkostenarten (Kostenrechnung) */
export type OverheadCategory =
  | "materialgemeinkosten"
  | "fertigungsgemeinkosten"
  | "verwaltungsgemeinkosten"
  | "vertriebsgemeinkosten";
/** Beeinflussbarkeit / Kostenverhalten */
export type OverheadCostBehavior = "fix" | "variabel" | "semi_variabel";
/** Bezugsgröße für den variablen Anteil */
export type OverheadVariableBasis = "stueck" | "umsatz";
export type OverheadAllocation =
  | "gleichmaessig"
  | "nach_umsatzanteil"
  | "nach_stueckzahl"
  | "manuell";

export type OverheadManualShare = {
  productId: string;
  percent: number;
};

export type OverheadItem = {
  id: string;
  name: string;
  betrag: number;
  waehrung: string;
  periode: OverheadPeriod;
  kategorie: OverheadCategory;
  /** Fix / variabel / semi-variabel — für Break-even & Szenarien */
  kostenart: OverheadCostBehavior;
  /**
   * Bezugsgröße des variablen Anteils.
   * Nur relevant bei kostenart variabel / semi_variabel.
   */
  variableBasis: OverheadVariableBasis | null;
  /**
   * Rate: bei `stueck` = € je Stück, bei `umsatz` = Prozent vom Umsatz.
   */
  variableRate: number | null;
  verteilschluessel: OverheadAllocation;
  /** Nur bei verteilschluessel = manuell; Summe der Prozente = 100 */
  manuelleAufteilung: OverheadManualShare[] | null;
  /**
   * Optionale Gültigkeit (YYYY-MM-DD).
   * `null` = unbefristet (von Anfang / bis unendlich).
   */
  gueltigVon: string | null;
  gueltigBis: string | null;
  createdAt: string;
  /** Letzte Änderung (ISO) — Audit */
  updatedAt: string;
  /** Anzeigename bei letzter Änderung, falls bekannt */
  updatedBy: string | null;
};

/**
 * Tatsächlich erfasste Gemeinkosten-Ausgabe (Ist).
 * Mehrere benannte Positionen je Monat/Kategorie möglich.
 * Optional an eine Plan-Position (`overheadItemId`) gekoppelt.
 */
export type OverheadActual = {
  id: string;
  /** Bezeichnung der Ausgabe, z. B. „Büromiete“ */
  name: string;
  /** YYYY-MM */
  month: string;
  kategorie: OverheadCategory;
  betrag: number;
  /** Optional: Bezug zur Plan-Position */
  overheadItemId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

/** Wiederkehrend vs. einmalig (z. B. Laptop bei Neueinstellung) */
export type PersonnelCadence = "monatlich" | "einmalig";

/** Abhängige Kosten einer Rolle (Büroplatz, Laptop, …) */
export type PersonnelDependency = {
  id: string;
  name: string;
  amount: number;
  cadence: PersonnelCadence;
  /** true = × Headcount / je Neueinstellung */
  scalesWithHeadcount: boolean;
};

/**
 * Personalrolle (Slidebean-ähnlich: Headcount × Gehalt + Nebenkosten + Pakete).
 * Wiederkehrende Anteile fließen in die Gemeinkosten-Umlegung.
 */
export type PersonnelRole = {
  id: string;
  name: string;
  /** Bruttogehalt je FTE / Monat */
  bruttoGehalt: number;
  /** AG-Lohnnebenkosten in % vom Brutto (z. B. 22) */
  lohnnebenkostenPercent: number;
  /** Vollzeitäquivalente */
  headcount: number;
  waehrung: string;
  kategorie: OverheadCategory;
  verteilschluessel: OverheadAllocation;
  manuelleAufteilung: OverheadManualShare[] | null;
  dependencies: PersonnelDependency[];
  gueltigVon: string | null;
  gueltigBis: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type AppData = {
  suppliers: Supplier[];
  /**
   * @deprecated Nach Migration immer leer.
   * Alte Beschaffungs-„Produkte“ wurden zu CatalogProduct + Component.
   */
  products: Product[];
  /** Verkaufskatalog */
  catalogProducts: CatalogProduct[];
  /** Komponenten-Stammdaten (wiederverwendbar) */
  components: Component[];
  /** BOM: Produkt ↔ Komponente (n:m) */
  productComponents: ProductComponent[];
  dealers: Dealer[];
  batches: Batch[];
  /** Wiederverwendbare Logistik-Kostenbausteine */
  logisticsBuildingBlocks: LogisticsBuildingBlock[];
  /** Zusammenstellungen von Bausteinen (Lanes / Vorlagen) */
  logisticsTemplates: LogisticsTemplate[];
  /** Plan: budgetierte wiederkehrende Positionen */
  overheadItems: OverheadItem[];
  /** Ist: tatsächlich erfasste, benannte Ausgaben */
  overheadActuals: OverheadActual[];
  /** Personalrollen (Gehalt + Nebenkosten + Abhängigkeiten) */
  personnelRoles: PersonnelRole[];
  /** Absatzplan: Stück je Produkt × Händler × Monat × Szenario */
  salesPlan: SalesPlanCell[];
  /** Plan-VK und Notizen je Zeile */
  salesPlanRowMeta: SalesPlanRowMeta[];
  /** Aktives Szenario + Freeze-Status */
  salesPlanSettings: SalesPlanSettings;
};

/** Phasen, die Logistik-Bausteine typischerweise nutzen */
export const LOGISTICS_PHASES: CostPhase[] = ["transport", "lager"];

/**
 * Stammdatensatz: einzelner wiederverwendbarer Logistik-Kostenbaustein.
 */
export type LogisticsBuildingBlock = {
  id: string;
  name: string;
  phase: CostPhase;
  allocation: CostAllocation;
  /** null = beim Anwenden Betrag manuell setzen */
  defaultAmount: number | null;
  notes: string;
};

/** Zeile in einer Logistik-Vorlage */
export type LogisticsTemplateItem = {
  id: string;
  buildingBlockId: string;
  /** null = Default-Betrag des Bausteins übernehmen */
  amountOverride: number | null;
};

/**
 * Vorlage („Lane“): geordnete Bausteine, optional gefiltert nach Incoterm/Route/Lieferant.
 */
export type LogisticsTemplate = {
  id: string;
  name: string;
  /** "" = beliebig */
  incoterm: string;
  /** ISO-Land oder "" */
  originCountry: string;
  /** ISO-Land oder "" */
  destinationCountry: string;
  /** "" = beliebig */
  supplierId: string;
  notes: string;
  items: LogisticsTemplateItem[];
};

export const COST_TYPE_PRESETS = [
  "Fracht",
  "Zoll",
  "QC / Inspection",
  "Montage / Repacking",
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

export const OVERHEAD_PERIODS: OverheadPeriod[] = [
  "monatlich",
  "quartalsweise",
  "jaehrlich",
];

export const OVERHEAD_CATEGORIES: OverheadCategory[] = [
  "materialgemeinkosten",
  "fertigungsgemeinkosten",
  "verwaltungsgemeinkosten",
  "vertriebsgemeinkosten",
];

export const OVERHEAD_COST_BEHAVIORS: OverheadCostBehavior[] = [
  "fix",
  "variabel",
  "semi_variabel",
];

export const OVERHEAD_VARIABLE_BASES: OverheadVariableBasis[] = [
  "stueck",
  "umsatz",
];

/** Alte Kategorie-Keys → aktuelles Schema */
export function migrateOverheadCategory(value: unknown): OverheadCategory {
  if (value === "materialgemeinkosten") return "materialgemeinkosten";
  if (value === "fertigungsgemeinkosten") return "fertigungsgemeinkosten";
  if (value === "verwaltungsgemeinkosten" || value === "verwaltung") {
    return "verwaltungsgemeinkosten";
  }
  if (value === "vertriebsgemeinkosten" || value === "vertrieb_fix") {
    return "vertriebsgemeinkosten";
  }
  if (value === "sonstige") return "materialgemeinkosten";
  return "verwaltungsgemeinkosten";
}

export function migrateOverheadCostBehavior(
  value: unknown,
): OverheadCostBehavior {
  if (value === "fix" || value === "variabel" || value === "semi_variabel") {
    return value;
  }
  return "fix";
}

export function migrateOverheadVariableBasis(
  value: unknown,
): OverheadVariableBasis | null {
  if (value === "stueck" || value === "umsatz") return value;
  return null;
}

export const OVERHEAD_ALLOCATIONS: OverheadAllocation[] = [
  "gleichmaessig",
  "nach_umsatzanteil",
  "nach_stueckzahl",
  "manuell",
];

export const PERSONNEL_CADENCES: PersonnelCadence[] = ["monatlich", "einmalig"];

/** Default AG-Lohnnebenkosten % (grobe DE-Planung, kein SV-Rechner) */
export const DEFAULT_LOHNNEBENKOSTEN_PERCENT = 22;

export const EMPTY_DATA: AppData = {
  suppliers: [],
  products: [],
  catalogProducts: [],
  components: [],
  productComponents: [],
  dealers: [],
  batches: [],
  logisticsBuildingBlocks: [],
  logisticsTemplates: [],
  overheadItems: [],
  overheadActuals: [],
  personnelRoles: [],
  salesPlan: [],
  salesPlanRowMeta: [],
  salesPlanSettings: { activeScenario: "base", frozen: [] },
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

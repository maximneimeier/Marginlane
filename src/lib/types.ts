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

/** Historischer Einkaufspreis einer Komponente */
export type ComponentPriceHistoryEntry = {
  id: string;
  /** ISO-Datum */
  date: string;
  price: number;
  currency: string;
  note: string;
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
  /** HS- / Zolltarifnummer (Stamm) */
  hsCode: string;
  /** Ursprungsland für Zoll */
  countryOfOrigin: string;
  /** Default-Zollsatz % vom Warenwert */
  dutyRatePercent: number;
  notes: string;
  /** Bis zu {@link MAX_PRODUCT_DOCUMENTS} Dokument-Referenzen */
  documents: ProductDocument[];
  /** Arbeitsplan light: Fertigungsschritte für dieses Produkt */
  routingSteps?: ProductRoutingStep[];
  createdAt: string;
};

/** Stundensatz-Art im Arbeitsplan */
export type RoutingRateType = "labor" | "machine";

/** Fertigungsschritt am Katalogprodukt (Arbeitsplan light) */
export type ProductRoutingStep = {
  id: string;
  name: string;
  sortOrder: number;
  /** Rüstzeit in Minuten je Los */
  setupMinutes: number;
  /** Bearbeitungszeit in Minuten je Output-Einheit */
  runMinutesPerUnit: number;
  /** Stundensatz in Produktwährung */
  hourlyRate: number;
  rateType: RoutingRateType;
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

/** Geplanter Umsatz je Produkt × Monat (FP&A: Menge × ASP) */
export type RevenuePlanCell = {
  productId: string;
  monthKey: string;
  /** Geplante Absatzmenge */
  quantity: number;
  /** Average Selling Price (€ je Einheit) */
  unitPrice: number;
};

/**
 * Geplanter Wareneinsatz (Consolidated COGS):
 * Kategorie → Kostenzeile → Betrag je Monat.
 */
export type CogsCategory = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CogsLineItem = {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CogsPlanCell = {
  lineItemId: string;
  monthKey: string;
  amount: number;
};

/** USt-Voranmeldungsrhythmus (DE) */
export type VatFilingCadence = "monthly" | "quarterly" | "annual";

export const VAT_FILING_CADENCES: VatFilingCadence[] = [
  "monthly",
  "quarterly",
  "annual",
];

/** Einzelner Umsatzsteuersatz (Stammdaten, zur Auswahl an Produkten/Buchungen) */
export type VatRate = {
  id: string;
  /** Anzeigename, z. B. „Regelsteuersatz“ */
  name: string;
  ratePercent: number;
};

/** Einzelne Personal-Default-Zeile (Pflichtabgabe oder Benefit) */
export type PersonnelDefaultKind = "mandatory" | "benefit";
/** Einheit der Zeile — Pflichtabgaben sind immer percent */
export type PersonnelDefaultUnit = "percent" | "annual" | "monthly";

export type PersonnelDefaultLine = {
  id: string;
  name: string;
  kind: PersonnelDefaultKind;
  unit: PersonnelDefaultUnit;
  value: number;
};

/** Anzeige/Eingabe von Zahlen: DE 1.234,56 vs. US 1,234.56 */
export type NumberFormatStyle = "de" | "en";

export const NUMBER_FORMAT_STYLES: NumberFormatStyle[] = ["de", "en"];

/** Ertragsteuer-Regime (Felder je Land) */
export type TaxRegime = "de" | "us" | "ch" | "other";

/** Alle bekannten Regime (inkl. noch nicht freigeschalteter) */
export const TAX_REGIMES: TaxRegime[] = ["de", "ch", "us", "other"];

/** Im UI wählbar (MVP) */
export const SELECTABLE_TAX_REGIMES: TaxRegime[] = ["de", "other"];

/** Regime mit nur einem Gesamtsteuersatz-Feld */
export const SIMPLE_TAX_REGIMES: TaxRegime[] = ["other"];

/** US State / Jurisdiction — freie Eingabe, kein festes State-Dropdown */
export type UsTaxJurisdiction = {
  id: string;
  name: string;
  incomeTaxPercent: number;
  franchiseTaxMin: number;
  /** Anteil am steuerpflichtigen Einkommen 0–100 */
  apportionmentPercent: number;
};

/**
 * Workspace-Unternehmensdaten (Finanzmodell-Annahmen).
 * Getrennt von Profil/Sprache in localStorage (`marginlane-prefs-v1`).
 */
export type FxRateHistoryEntry = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  rates: Record<string, number>;
  note: string;
};

/** Preisbasis für Produktions-Vorkalkulation (nicht für Lagerabbuchung). */
export const PRODUCTION_COST_BASES = [
  "list",
  "last_landed",
  "fifo_stock",
] as const;
export type ProductionCostBasis = (typeof PRODUCTION_COST_BASES)[number];

export type CompanySettings = {
  companyName: string;
  /** Workspace-Basiswährung (z. B. neue Gehälter) */
  baseCurrency: string;
  /** Modellstart YYYY-MM */
  modelStartMonth: string;
  /** Modellende YYYY-MM */
  lastActualMonth: string;
  startingEquity: number;
  startingCash: number;
  /** Offene USt zum Modellstart */
  vatOwedAtStart: number;
  /** Offene Ertragsteuern zum Modellstart */
  incomeTaxesOwedAtStart: number;
  /** Welches Länder-Feldset unter Ertragsteuern */
  taxRegime: TaxRegime;
  /** Fiskaljahr-Startmonat 1–12 */
  fiscalYearStartMonth: number;
  /** Monat der Steuerkonsolidierung / Filing 1–12 */
  taxConsolidationMonth: number;
  /** Vorauszahlungsrhythmus Ertragsteuern */
  incomeTaxPaymentCadence: VatFilingCadence;
  /** DE: Körperschaftsteuer % */
  koerperschaftsteuerPercent: number;
  /** DE: Solidaritätszuschlag % auf KSt */
  solidaritaetszuschlagPercent: number;
  /** DE: Steuermesszahl GewSt % (typisch 3,5) */
  gewerbesteuerMesszahlPercent: number;
  /** DE: Hebesatz der Gemeinde (z. B. 400) */
  gewerbesteuerHebesatz: number;
  /** US: Federal Income Tax % (gesetzlich typisch 21) */
  usFederalIncomeTaxPercent: number;
  /** US: Sitzstaat (ISO-ähnlich, z. B. CA, NY, DC) */
  usStateCode: string;
  /** US: staatlicher Körperschaftsteuersatz % (editierbarer Planungswert) */
  usStateTaxPercent: number;
  /** US: optionale lokale Unternehmenssteuer % */
  usLocalTaxPercent: number;
  /**
   * @deprecated Multi-State-UI entfernt — nur noch für Migration alter Daten.
   */
  usTaxJurisdictions: UsTaxJurisdiction[];
  /** CH: Direkte Bundessteuer % (nominal typisch 8,5) */
  chFederalTaxPercent: number;
  /** CH: Kantonaler Gewinnsteuer-Grundtarif % */
  chCantonalTaxPercent: number;
  /** CH: Kantonaler Steuerfuss % (Multiplikator auf Grundtarif) */
  chCantonalTaxFoot: number;
  /** CH: Gemeindesteuerfuss % (auf kantonalen Grundtarif) */
  chMunicipalTaxFoot: number;
  /** CH: optionale Kapitalsteuer aktiv */
  chCapitalTaxEnabled: boolean;
  /** CH: Kapitalsteuersatz in ‰ (nur wenn aktiv) */
  chCapitalTaxPermille: number;
  /** UK / NL / other: Körperschaft- bzw. Gesamtsteuersatz % */
  corporateTaxPercent: number;
  /** Bei Regime „other“: freier Ländername */
  otherTaxCountryName: string;
  /**
   * Pflegbare Umsatzsteuersätze (DE z. B. 19 % / 7 % / 0 %).
   * Auswahl erfolgt über `defaultVatRateId` bzw. später produktbezogen.
   */
  vatRates: VatRate[];
  /** Aktiver/Standard-USt-Satz aus `vatRates` */
  defaultVatRateId: string;
  /**
   * @deprecated Abgeleitet aus dem Default-Satz — bleibt für Rückwärtskompatibilität.
   */
  vatRatePercent: number;
  vatFilingCadence: VatFilingCadence;
  /**
   * Freie Personal-Defaults: Pflichtabgaben (%) und Benefits (% / Jahr / Monat).
   * Aggregate unten werden daraus abgeleitet.
   */
  personnelDefaultLines: PersonnelDefaultLine[];
  /** Summe Pflichtabgaben % (aus personnelDefaultLines) */
  defaultLohnnebenkostenPercent: number;
  /**
   * Summe Benefit-% (aus personnelDefaultLines).
   * @deprecated Abgeleitet — bleibt für Rollen-Defaults
   */
  defaultZusatzAgPercent: number;
  /**
   * Summe fester Benefits / Monat (Jahresbeträge / 12 + Monatsbeträge).
   * @deprecated Abgeleitet — bleibt für Rollen-Defaults
   */
  defaultBenefitsMonthly: number;
  defaultAnnualIncreasePercent: number;
  /** Bewertung / Capital Cost Inputs */
  costOfEquityPercent: number;
  costOfDebtPercent: number;
  valuationCorporateTaxPercent: number;
  expectedMarketReturnPercent: number;
  riskFreeRatePercent: number;
  equityBeta: number;
  /** Optional Bewertung */
  waccPercent: number | null;
  terminalGrowthPercent: number | null;
  /**
   * FX: Einheiten baseCurrency pro 1 Einheit Fremdwährung.
   * baseCurrency selbst ist immer 1.
   */
  fxRates: Record<string, number>;
  /** Historische Kurstabellen (neueste zuerst empfohlen) */
  fxRateHistory: FxRateHistoryEntry[];
  /**
   * Vorkalkulation Material-EK in Produktionsläufen.
   * Abbuchung beim Abschluss bleibt immer FIFO-Landed der verbrauchten Chargen.
   */
  productionCostBasis: ProductionCostBasis;
};

export const EMPTY_COMPANY_SETTINGS: CompanySettings = {
  companyName: "",
  baseCurrency: "EUR",
  modelStartMonth: "",
  lastActualMonth: "",
  startingEquity: 0,
  startingCash: 0,
  vatOwedAtStart: 0,
  incomeTaxesOwedAtStart: 0,
  taxRegime: "de",
  fiscalYearStartMonth: 1,
  taxConsolidationMonth: 4,
  incomeTaxPaymentCadence: "quarterly",
  koerperschaftsteuerPercent: 15,
  solidaritaetszuschlagPercent: 5.5,
  gewerbesteuerMesszahlPercent: 3.5,
  gewerbesteuerHebesatz: 400,
  usFederalIncomeTaxPercent: 21,
  usStateCode: "DE",
  usStateTaxPercent: 8.7,
  usLocalTaxPercent: 0,
  usTaxJurisdictions: [],
  chFederalTaxPercent: 8.5,
  chCantonalTaxPercent: 3.5,
  chCantonalTaxFoot: 100,
  chMunicipalTaxFoot: 100,
  chCapitalTaxEnabled: false,
  chCapitalTaxPermille: 0,
  corporateTaxPercent: 25,
  otherTaxCountryName: "",
  vatRates: [
    { id: "vat_standard", name: "Regelsteuersatz", ratePercent: 19 },
    { id: "vat_reduced", name: "Ermäßigter Steuersatz", ratePercent: 7 },
    { id: "vat_zero", name: "Steuerfrei / 0 %", ratePercent: 0 },
  ],
  defaultVatRateId: "vat_standard",
  vatRatePercent: 19,
  vatFilingCadence: "monthly",
  personnelDefaultLines: [],
  defaultLohnnebenkostenPercent: 0,
  defaultZusatzAgPercent: 0,
  defaultBenefitsMonthly: 0,
  defaultAnnualIncreasePercent: 3,
  costOfEquityPercent: 7.17,
  costOfDebtPercent: 7.85,
  valuationCorporateTaxPercent: 29.84,
  expectedMarketReturnPercent: 9,
  riskFreeRatePercent: 4.43,
  equityBeta: 0.6,
  waccPercent: null,
  terminalGrowthPercent: null,
  fxRates: {
    EUR: 1,
    USD: 0.92,
    CNY: 0.127,
    GBP: 1.17,
    CHF: 1.04,
    JPY: 0.0062,
    HKD: 0.118,
  },
  fxRateHistory: [],
  productionCostBasis: "list",
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
  /** Mindestbestellmenge in Komponenten-Einheiten */
  moq: number;
  /** Mengenstaffeln auf Listen-EK */
  discountTiers: DiscountTier[];
  /** EK-Historie (neueste zuerst empfohlen) */
  priceHistory: ComponentPriceHistoryEntry[];
  /** HS- / Zolltarifnummer */
  hsCode: string;
  countryOfOrigin: string;
  dutyRatePercent: number;
  /** Freitext, z. B. Verpackungseinheiten beim Lieferanten */
  notes: string;
  /**
   * Katalogprodukt, dessen Chargen den physischen Teilebestand halten.
   * `null`/fehlend = kein Lagerbezug (nur Kalkulation).
   */
  stockProductId?: string | null;
  /**
   * Override der Firmen-Regel `productionCostBasis` für die Vorkalkulation.
   * `null` = Firmen-Default.
   */
  costBasisOverride?: ProductionCostBasis | null;
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
  /**
   * Ausschuss/Schwund 0–1 je BOM-Position.
   * Bedarf = Menge × (1 + scrapRate).
   */
  scrapRate?: number;
  /** null = Standard-EK der Component */
  purchasePriceOverride: number | null;
};

/**
 * Beschaffungsquellen: dasselbe Katalogprodukt kann von mehreren Lieferanten
 * bezogen werden; ein Lieferant kann mehrere Produkte liefern.
 */
export type ProductSupplier = {
  id: string;
  productId: string;
  supplierId: string;
  /**
   * Optionaler Listen-EK für dieses Produkt beim Lieferanten.
   * `null` = EK aus BOM-Komponenten dieses Lieferanten bzw. Gesamt-BOM.
   */
  unitPurchasePrice: number | null;
  /** Bevorzugte Quelle in Dropdowns */
  preferred: boolean;
  notes: string;
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

/** Nicht-Verkaufs-Abbuchung vom Chargenbestand (z. B. Produktion) */
export type BatchConsumption = {
  id: string;
  productionRunId: string;
  componentId: string;
  quantity: number;
  createdAt: string;
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

export type BatchDuty = {
  /** HS- / Zolltarifnummer */
  hsCode: string;
  /** Ursprungsland */
  countryOfOrigin: string;
  /** Zollsatz % vom Warenwert */
  ratePercent: number;
  /** Pauschaler Zollbetrag (Einkaufswährung) */
  fixedAmount: number;
};

/** Alternative Beschaffungs-Quote derselben Charge (What-if) */
export type BatchQuote = {
  id: string;
  label: string;
  supplierId: string;
  unitPurchasePrice: number | null;
  currency: string | null;
  paymentDays: number | null;
  paymentUnit: PaymentUnit | null;
  skontoPercent: number | null;
  skontoDays: number | null;
  incoterm: string | null;
  costItems: CostItem[];
  applySkonto: boolean | null;
  fxRateOverride: number | null;
  duty: BatchDuty;
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
  /** Produktions-/sonstige Abbuchungen (nicht Umsatz) */
  consumptions?: BatchConsumption[];
  createdAt: string;
  /** Bestellung / PO (ISO). Fallback: createdAt */
  orderDate: string | null;
  /** Geplante Ankunft / ETA (ISO). Ohne Ist-Ankunft → Status „unterwegs“ */
  expectedArrivalDate: string | null;
  /** Wareneingang / Ist-Ankunft (ISO). ≤ heute → im Lager */
  arrivalDate: string | null;
  /** Verkaufsdatum für Umsatz-Zuordnung (ISO). Fallback: createdAt */
  soldDate: string | null;
  /** Bestell-/PO-Nummer (Freitext) */
  poNumber: string;
  /** Interne Notiz zur Charge */
  notes: string;
  /**
   * Tatsächlich gelieferte Menge in pricingUnit.
   * `null` = Bestellmenge (`quantity`) annehmen.
   */
  receivedQuantity: number | null;
  /**
   * Skonto in Unit Economics anwenden.
   * `null` = automatisch wenn skontoPercent > 0.
   */
  applySkonto: boolean | null;
  /**
   * Override: Einheiten baseCurrency pro 1 Einheit Einkaufswährung.
   * `null` = Company-FX-Tabelle / Historie.
   */
  fxRateOverride: number | null;
  /** Zoll / Duty */
  duty: BatchDuty;
  /** Alternative Quotes (What-if) — Basisdaten bleiben die „aktive“ Beschaffung */
  quotes: BatchQuote[];
  /** Aktive Quote; null = Batch-Stammdaten */
  activeQuoteId: string | null;
};

export function emptyBatchDuty(): BatchDuty {
  return {
    hsCode: "",
    countryOfOrigin: "",
    ratePercent: 0,
    fixedAmount: 0,
  };
}

/** Stufe 1: kalkulatorischer Fertigungslauf (ohne harten Bestandverbrauch) */
export type ProductionRunStatus = "planned" | "done" | "cancelled";

export type ProductionRunInput = {
  id: string;
  componentId: string;
  /** Komponentenmenge pro Output-Einheit */
  quantityPerOutput: number;
  /** null = Stamm-EK / BOM-Override der Komponente */
  unitCostOverride: number | null;
};

/** Gebuchte Input-Abbuchung nach Abschluss */
export type ProductionConsumption = {
  id: string;
  componentId: string;
  batchId: string;
  quantity: number;
};

export type ProductionRun = {
  id: string;
  label: string;
  outputProductId: string;
  /** Geplante Gutmenge (nach Ausschuss) */
  outputQuantity: number;
  /** Ausschuss 0–1 — erhöht Materialbedarf, nicht die Gutmenge */
  scrapRate: number;
  inputs: ProductionRunInput[];
  /** Fertigungskosten (Montage, Lohn, …) — typisch Phase einkauf */
  costItems: CostItem[];
  status: ProductionRunStatus;
  notes: string;
  createdAt: string;
  completedAt: string | null;
  /** Nach Abschluss: erzeugte Fertigware-Charge */
  outputBatchId: string | null;
  /** Nach Abschluss: FIFO-Abbuchungen vom Komponentenlager */
  consumptions: ProductionConsumption[];
};

/** Phasen für Fertigungskosten am Production Run */
export const PRODUCTION_COST_PHASES: CostPhase[] = ["einkauf"];

/** Wiederkehrende Gemeinkosten-Position (Unternehmensoverhead) */
export type OverheadPeriod = "monatlich" | "quartalsweise" | "jaehrlich";
/** Klassische Gemeinkostenarten (Kostenrechnung) */
export type OverheadCategory =
  | "materialgemeinkosten"
  | "fertigungsgemeinkosten"
  | "verwaltungsgemeinkosten"
  | "vertriebsgemeinkosten"
  | "lagerungsgemeinkosten";
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

/** Single Hire vs. skalierendes Team (Slidebean-ähnlich) */
export type PersonnelRoleType = "single" | "scaling";

/** Wie oft neue Hires geplant werden */
export type PersonnelHireFrequency =
  | "once"
  | "yearly"
  | "semiannual"
  | "quarterly"
  | "monthly";

/** Organisatorisches Team / Abteilung (Stammdaten) für Personal-Gruppierung */
export type PersonnelTeam = {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

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
  /** Stammdaten-Team (Sales, Marketing, …); leer = ohne Team */
  teamId: string;
  /** Bruttogehalt je FTE / Monat */
  bruttoGehalt: number;
  /** AG-Lohnnebenkosten in % vom Brutto (z. B. 22) */
  lohnnebenkostenPercent: number;
  /**
   * Weitere AG-Anteile in % vom Brutto
   * (z. B. bAV, Unfallversicherung — analog Workers’ Comp / 401k).
   */
  zusatzAgPercent: number;
  /** Benefits / Sachbezüge je FTE / Monat (Health & Perks) */
  benefitsMonthly: number;
  /** Geplante jährliche Gehaltssteigerung % */
  annualIncreasePercent: number;
  /** Single Hire oder Scaling Team */
  roleType: PersonnelRoleType;
  /** Aktuelle Vollzeitäquivalente */
  headcount: number;
  /** Bei Scaling: Hires pro Periode */
  hiresPerPeriod: number;
  /** Bei Scaling: Rhythmus */
  hireFrequency: PersonnelHireFrequency;
  /** Bei Scaling: Obergrenze; null = unbegrenzt */
  maxHeadcount: number | null;
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
  /** Beschaffungsquellen: Produkt ↔ Lieferant (n:m) */
  productSuppliers: ProductSupplier[];
  dealers: Dealer[];
  batches: Batch[];
  /** Fertigungsläufe: BOM-Inputs + Fertigungskosten → Fertigware-Charge */
  productionRuns: ProductionRun[];
  /** Wiederverwendbare Logistik-Kostenbausteine */
  logisticsBuildingBlocks: LogisticsBuildingBlock[];
  /** Zusammenstellungen von Bausteinen (Lanes / Vorlagen) */
  logisticsTemplates: LogisticsTemplate[];
  /** Plan: budgetierte wiederkehrende Positionen */
  overheadItems: OverheadItem[];
  /** Ist: tatsächlich erfasste, benannte Ausgaben */
  overheadActuals: OverheadActual[];
  /** Teams / Abteilungen für Personal-Gruppierung */
  personnelTeams: PersonnelTeam[];
  /** Personalrollen (Gehalt + Nebenkosten + Abhängigkeiten) */
  personnelRoles: PersonnelRole[];
  /** Absatzplan: Stück je Produkt × Händler × Monat × Szenario */
  salesPlan: SalesPlanCell[];
  /** Plan-VK und Notizen je Zeile */
  salesPlanRowMeta: SalesPlanRowMeta[];
  /** Aktives Szenario + Freeze-Status */
  salesPlanSettings: SalesPlanSettings;
  /**
   * Geplanter Umsatz (Top-Line) je Monat — unabhängig vom Absatzplan.
   */
  revenuePlan: RevenuePlanCell[];
  /** COGS-Kategorien (Consolidated-Sektionen) */
  cogsCategories: CogsCategory[];
  /** COGS-Kostenzeilen je Kategorie */
  cogsLineItems: CogsLineItem[];
  /** Geplante Beträge je Kostenzeile × Monat */
  cogsPlan: CogsPlanCell[];
  /** Firmen-/Modellannahmen (Stammdaten → Unternehmen) */
  companySettings: CompanySettings;
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
  "lagerungsgemeinkosten",
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
  if (
    value === "lagerungsgemeinkosten" ||
    value === "lager" ||
    value === "lagerkosten"
  ) {
    return "lagerungsgemeinkosten";
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

export const PERSONNEL_ROLE_TYPES: PersonnelRoleType[] = ["single", "scaling"];

export const PERSONNEL_HIRE_FREQUENCIES: PersonnelHireFrequency[] = [
  "once",
  "yearly",
  "semiannual",
  "quarterly",
  "monthly",
];

/** Default AG-Lohnnebenkosten % wenn keine Firmen-Defaults gesetzt */
export const DEFAULT_LOHNNEBENKOSTEN_PERCENT = 0;

export const EMPTY_DATA: AppData = {
  suppliers: [],
  products: [],
  catalogProducts: [],
  components: [],
  productComponents: [],
  productSuppliers: [],
  dealers: [],
  batches: [],
  productionRuns: [],
  logisticsBuildingBlocks: [],
  logisticsTemplates: [],
  overheadItems: [],
  overheadActuals: [],
  personnelTeams: [],
  personnelRoles: [],
  salesPlan: [],
  salesPlanRowMeta: [],
  salesPlanSettings: { activeScenario: "base", frozen: [] },
  revenuePlan: [],
  cogsCategories: [],
  cogsLineItems: [],
  cogsPlan: [],
  companySettings: { ...EMPTY_COMPANY_SETTINGS },
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

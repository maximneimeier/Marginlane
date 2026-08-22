/**
 * Demo-Stammdaten in die Demo-Projekte schreiben (Investa + Costerra).
 *
 * Usage: npx tsx scripts/seed-demo-masterdata.ts
 */
import "dotenv/config";
import { createId } from "../src/lib/format";
import {
  getWorkspace,
  saveWorkspaceData,
} from "../src/lib/db/workspace";
import type {
  AppData,
  Batch,
  CatalogProduct,
  Component,
  CostItem,
  Dealer,
  LogisticsBuildingBlock,
  LogisticsTemplate,
  OverheadItem,
  PersonnelRole,
  PersonnelTeam,
  ProductComponent,
  ProductDocument,
  ProductSupplier,
  Sale,
  Supplier,
} from "../src/lib/types";
import { DEFAULT_LOHNNEBENKOSTEN_PERCENT, formatPaymentTerms } from "../src/lib/types";


const NOW = new Date().toISOString();

function docs(
  ...items: Array<[string, string, string, string]>
): ProductDocument[] {
  return items.map(([id, title, url, notes]) => ({
    id,
    title,
    url,
    notes,
  }));
}

function cost(
  id: string,
  type: string,
  amount: number,
  allocation: CostItem["allocation"],
): CostItem {
  return {
    id,
    type,
    label: type,
    amount,
    allocation,
    phase: "vertrieb",
  };
}

function supplier(partial: Omit<Supplier, "paymentTerms" | "createdAt"> & {
  createdAt?: string;
}): Supplier {
  const s = {
    ...partial,
    createdAt: partial.createdAt ?? NOW,
    paymentTerms: "",
  };
  s.paymentTerms = formatPaymentTerms(s);
  return s;
}

const SUPPLIERS: Supplier[] = [
  supplier({
    id: "sup_demo_vinh",
    name: "Vinh Long Furniture Co., Ltd.",
    country: "VN",
    contactName: "Nguyen Thi Lan",
    email: "lan.nguyen@vinhlongfurniture.vn",
    phone: "",
    currency: "USD",
    paymentDays: 30,
    paymentUnit: "Tage",
    skontoPercent: 2,
    skontoDays: 10,
    incoterm: "FOB",
    taxId: "",
    legalForm: "Co., Ltd.",
    website: "",
    originPort: "Ho Chi Minh City",
    leadTimeDays: 45,
    iban: "Vietcombank · bitte SWIFT/IBAN beim Lieferanten erfragen",
    certifications: "",
    status: "active",
    notes:
      "Bevorzugt Anzahlung 30% vor Produktionsstart. Drittland — USt-IdNr. meist nicht zutreffend. Incoterm: FOB Ho Chi Minh City.",
  }),
  supplier({
    id: "sup_demo_yiwu",
    name: "Yiwu Sunshine Trading Co., Ltd.",
    country: "CN",
    contactName: "Wei Zhang",
    email: "wei.zhang@sunshine-trading.cn",
    phone: "",
    currency: "USD",
    paymentDays: 45,
    paymentUnit: "Tage",
    skontoPercent: 0,
    skontoDays: 0,
    incoterm: "EXW",
    taxId: "",
    legalForm: "Co., Ltd.",
    website: "",
    originPort: "Yiwu",
    leadTimeDays: 30,
    iban: "",
    certifications: "",
    status: "active",
    notes:
      "MOQ pro Artikel unterschiedlich, siehe Produktebene. Incoterm: EXW Yiwu.",
  }),
  supplier({
    id: "sup_demo_ningbo",
    name: "Ningbo Rider Parts Co., Ltd.",
    country: "CN",
    contactName: "Li Wang",
    email: "li.wang@riderparts.cn",
    phone: "",
    currency: "EUR",
    paymentDays: 60,
    paymentUnit: "Tage",
    skontoPercent: 0,
    skontoDays: 0,
    incoterm: "FOB",
    taxId: "",
    legalForm: "Co., Ltd.",
    website: "",
    originPort: "Ningbo",
    leadTimeDays: 35,
    iban: "Bank of China Ningbo Branch · SWIFT/IBAN erfragen",
    certifications: "",
    status: "active",
    notes:
      "Rechnungsstellung in EUR möglich, sonst USD. Incoterm: FOB Ningbo.",
  }),
];

const PRODUCTS: CatalogProduct[] = [
  {
    id: "prd_demo_lounge",
    name: "Gartenmöbel-Set Lounge (4-teilig)",
    sku: "GM-LOUNGE01",
    listPrice: null,
    pricingUnit: "pcs",
    currency: "USD",
    status: "active",
    category: "Gartenmöbel",
    targetMarginPercent: null,
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes:
      "BOM: Sofa + Tisch + 2× Kissen. Richt-EK ca. 189 USD/Set. MOQ 20 Sets. Lieferant: Vinh Long Furniture.",
    documents: docs(
      [
        "doc_demo_lounge_spec",
        "Technische Spezifikation",
        "https://example.com/docs/gm-lounge01-spec.pdf",
        "Maße, Materialien, Belastungen",
      ],
      [
        "doc_demo_lounge_pack",
        "Verpackungszeichnung",
        "https://example.com/docs/gm-lounge01-pack.pdf",
        "Kartonmaße und Stapelhöhe",
      ],
      [
        "doc_demo_lounge_cert",
        "Holz-Zertifikat (FSC)",
        "https://example.com/docs/gm-lounge01-fsc.pdf",
        "Gültig bis Folgeaudit",
      ],
    ),
    createdAt: NOW,
  },
  {
    id: "prd_demo_xmas",
    name: "Weihnachtsdeko-Set (12-teilig)",
    sku: "XMAS-SET01",
    listPrice: null,
    pricingUnit: "pcs",
    currency: "USD",
    status: "active",
    category: "Saisondeko",
    targetMarginPercent: null,
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes:
      "EK aus BOM (8× Ornament + Band + Karte). MOQ 200 Sets. VPE 1 Set/Geschenkbox.",
    documents: docs(
      [
        "doc_demo_xmas_bom",
        "Stücklisten-Übersicht",
        "https://example.com/docs/xmas-set01-bom.pdf",
        "Inhaltsliste 12-teilig",
      ],
      [
        "doc_demo_xmas_photo",
        "Produktfotos Packshot",
        "https://example.com/docs/xmas-set01-photos.zip",
        "Retail- und Amazon-Bilder",
      ],
      [
        "doc_demo_xmas_safety",
        "Sicherheitsdatenblatt",
        "https://example.com/docs/xmas-set01-sds.pdf",
        "Glasbruch / Kleinteile",
      ],
    ),
    createdAt: NOW,
  },
  {
    id: "prd_demo_bike",
    name: "Fahrradzubehör-Set (LED-Licht + Klingel)",
    sku: "BIKE-ACC01",
    listPrice: null,
    pricingUnit: "pcs",
    currency: "USD",
    status: "active",
    category: "Fahrradzubehör",
    targetMarginPercent: null,
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes:
      "EK aus BOM (LED + Klingel + Halter). MOQ 500 Sets. VPE 1 Set/Blister.",
    documents: docs(
      [
        "doc_demo_bike_ce",
        "CE-Konformitätserklärung",
        "https://example.com/docs/bike-acc01-ce.pdf",
        "LED-Beleuchtung",
      ],
      [
        "doc_demo_bike_manual",
        "Bedienungsanleitung DE/EN",
        "https://example.com/docs/bike-acc01-manual.pdf",
        "Montage und Akku",
      ],
      [
        "doc_demo_bike_qc",
        "QC-Checkliste",
        "https://example.com/docs/bike-acc01-qc.pdf",
        "Wareneingangsprüfung",
      ],
    ),
    createdAt: NOW,
  },
];

/** Lagerartikel für Komponenten (werden bestellt / eingelagert) */
const PART_PRODUCTS: CatalogProduct[] = [
  {
    id: "prd_stock_led",
    name: "LED-Frontlicht USB-C",
    sku: "LRP-LED-001",
    listPrice: null,
    pricingUnit: "pcs",
    currency: "USD",
    status: "active",
    category: "Einzelteil",
    targetMarginPercent: null,
    hsCode: "",
    countryOfOrigin: "CN",
    dutyRatePercent: 0,
    notes: "Lagerartikel für Komponente LED",
    documents: [],
    createdAt: NOW,
  },
  {
    id: "prd_stock_bell",
    name: "Fahrradklingel Aluminium",
    sku: "LRP-BELL-002",
    listPrice: null,
    pricingUnit: "pcs",
    currency: "USD",
    status: "active",
    category: "Einzelteil",
    targetMarginPercent: null,
    hsCode: "",
    countryOfOrigin: "CN",
    dutyRatePercent: 0,
    notes: "Lagerartikel für Komponente Klingel",
    documents: [],
    createdAt: NOW,
  },
  {
    id: "prd_stock_ornament",
    name: "Glaskugel-Ornament 6cm rot",
    sku: "YST-ORN-RED6",
    listPrice: null,
    pricingUnit: "pcs",
    currency: "USD",
    status: "active",
    category: "Einzelteil",
    targetMarginPercent: null,
    hsCode: "",
    countryOfOrigin: "CN",
    dutyRatePercent: 0,
    notes: "Lagerartikel für Komponente Ornament",
    documents: [],
    createdAt: NOW,
  },
  {
    id: "prd_stock_sofa",
    name: "Lounge-Sofa Rattan",
    sku: "VLF-SOFA-01",
    listPrice: null,
    pricingUnit: "pcs",
    currency: "USD",
    status: "active",
    category: "Einzelteil",
    targetMarginPercent: null,
    hsCode: "",
    countryOfOrigin: "VN",
    dutyRatePercent: 0,
    notes: "Lagerartikel für Komponente Sofa",
    documents: [],
    createdAt: NOW,
  },
  {
    id: "prd_stock_table",
    name: "Beistelltisch Holz",
    sku: "VLF-TBL-01",
    listPrice: null,
    pricingUnit: "pcs",
    currency: "USD",
    status: "active",
    category: "Einzelteil",
    targetMarginPercent: null,
    hsCode: "",
    countryOfOrigin: "VN",
    dutyRatePercent: 0,
    notes: "Lagerartikel für Komponente Tisch",
    documents: [],
    createdAt: NOW,
  },
];

const COMPONENTS: Component[] = [
  {
    id: "cmp_demo_led",
    supplierId: "sup_demo_ningbo",
    name: "LED-Frontlicht USB-C",
    sku: "LRP-LED-001",
    currency: "USD",
    purchasePricePerUnit: 1.85,
    moq: 0,
    discountTiers: [],
    priceHistory: [],
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "Wasserdicht IPX4",
    stockProductId: "prd_stock_led",
  },
  {
    id: "cmp_demo_bell",
    supplierId: "sup_demo_ningbo",
    name: "Fahrradklingel Aluminium",
    sku: "LRP-BELL-002",
    currency: "USD",
    purchasePricePerUnit: 0.65,
    moq: 0,
    discountTiers: [],
    priceHistory: [],
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "",
    stockProductId: "prd_stock_bell",
  },
  {
    id: "cmp_demo_mount",
    supplierId: "sup_demo_ningbo",
    name: "Universal-Halterung Lenker",
    sku: "LRP-MNT-003",
    currency: "USD",
    purchasePricePerUnit: 0.4,
    moq: 0,
    discountTiers: [],
    priceHistory: [],
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "Passend zu LED und Klingel",
    stockProductId: null,
  },
  {
    id: "cmp_demo_ornament",
    supplierId: "sup_demo_yiwu",
    name: "Glaskugel-Ornament 6cm rot",
    sku: "YST-ORN-RED6",
    currency: "USD",
    purchasePricePerUnit: 0.32,
    moq: 0,
    discountTiers: [],
    priceHistory: [],
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "12er-Bündel beim Lieferanten, EK ist Einzelpreis",
    stockProductId: "prd_stock_ornament",
  },
  {
    id: "cmp_demo_ribbon",
    supplierId: "",
    name: "Geschenkband Satin 2m",
    sku: "",
    currency: "USD",
    purchasePricePerUnit: 0.18,
    moq: 0,
    discountTiers: [],
    priceHistory: [],
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "Preis vorläufig geschätzt, Angebot ausstehend",
    stockProductId: null,
  },
  {
    id: "cmp_demo_card",
    supplierId: "sup_demo_yiwu",
    name: "Grußkarte Weihnachten",
    sku: "YST-CARD-XMAS",
    currency: "USD",
    purchasePricePerUnit: 0.12,
    moq: 0,
    discountTiers: [],
    priceHistory: [],
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "Zweisprachig DE/EN",
    stockProductId: null,
  },
  {
    id: "cmp_demo_sofa",
    supplierId: "sup_demo_vinh",
    name: "Lounge-Sofa Rattan",
    sku: "VLF-SOFA-01",
    currency: "USD",
    purchasePricePerUnit: 95,
    moq: 0,
    discountTiers: [],
    priceHistory: [],
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "Hauptteil des Sets",
    stockProductId: "prd_stock_sofa",
  },
  {
    id: "cmp_demo_table",
    supplierId: "sup_demo_vinh",
    name: "Beistelltisch Holz",
    sku: "VLF-TBL-01",
    currency: "USD",
    purchasePricePerUnit: 48,
    moq: 0,
    discountTiers: [],
    priceHistory: [],
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "",
    stockProductId: "prd_stock_table",
  },
  {
    id: "cmp_demo_cushion",
    supplierId: "sup_demo_vinh",
    name: "Outdoor-Kissen",
    sku: "VLF-CUSH-01",
    currency: "USD",
    purchasePricePerUnit: 23,
    moq: 0,
    discountTiers: [],
    priceHistory: [],
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "2 Stück pro Set",
    stockProductId: null,
  },
];

const LINKS: ProductComponent[] = [
  {
    id: "pc_demo_lounge_sofa",
    productId: "prd_demo_lounge",
    componentId: "cmp_demo_sofa",
    quantityPerProductUnit: 1,
    purchasePriceOverride: null,
  },
  {
    id: "pc_demo_lounge_table",
    productId: "prd_demo_lounge",
    componentId: "cmp_demo_table",
    quantityPerProductUnit: 1,
    purchasePriceOverride: null,
  },
  {
    id: "pc_demo_lounge_cushion",
    productId: "prd_demo_lounge",
    componentId: "cmp_demo_cushion",
    quantityPerProductUnit: 2,
    purchasePriceOverride: null,
  },
  {
    id: "pc_demo_xmas_ornament",
    productId: "prd_demo_xmas",
    componentId: "cmp_demo_ornament",
    quantityPerProductUnit: 8,
    purchasePriceOverride: null,
  },
  {
    id: "pc_demo_xmas_ribbon",
    productId: "prd_demo_xmas",
    componentId: "cmp_demo_ribbon",
    quantityPerProductUnit: 1,
    purchasePriceOverride: null,
  },
  {
    id: "pc_demo_xmas_card",
    productId: "prd_demo_xmas",
    componentId: "cmp_demo_card",
    quantityPerProductUnit: 1,
    purchasePriceOverride: null,
  },
  {
    id: "pc_demo_bike_led",
    productId: "prd_demo_bike",
    componentId: "cmp_demo_led",
    quantityPerProductUnit: 1,
    purchasePriceOverride: null,
  },
  {
    id: "pc_demo_bike_bell",
    productId: "prd_demo_bike",
    componentId: "cmp_demo_bell",
    quantityPerProductUnit: 1,
    purchasePriceOverride: null,
  },
  {
    id: "pc_demo_bike_mount",
    productId: "prd_demo_bike",
    componentId: "cmp_demo_mount",
    quantityPerProductUnit: 1,
    purchasePriceOverride: null,
  },
];

/** Explizite Quellen: Lounge auch alternativ bei Yiwu (anderer Listen-EK). */
const PRODUCT_SUPPLIERS: ProductSupplier[] = [
  {
    id: "ps_demo_lounge_vinh",
    productId: "prd_demo_lounge",
    supplierId: "sup_demo_vinh",
    unitPurchasePrice: null,
    preferred: true,
    notes: "Hauptquelle HCMC",
  },
  {
    id: "ps_demo_lounge_yiwu",
    productId: "prd_demo_lounge",
    supplierId: "sup_demo_yiwu",
    unitPurchasePrice: 118,
    preferred: false,
    notes: "Alternative Quelle Yiwu — Listen-EK",
  },
  {
    id: "ps_demo_bike_ningbo",
    productId: "prd_demo_bike",
    supplierId: "sup_demo_ningbo",
    unitPurchasePrice: null,
    preferred: true,
    notes: "",
  },
  {
    id: "ps_demo_xmas_yiwu",
    productId: "prd_demo_xmas",
    supplierId: "sup_demo_yiwu",
    unitPurchasePrice: null,
    preferred: true,
    notes: "",
  },
];

const LOGISTICS_BLOCKS: LogisticsBuildingBlock[] = [
  {
    id: "lbb_demo_pickup",
    name: "Vorlauf / Abholung Herkunft",
    phase: "transport",
    allocation: "lump_sum",
    defaultAmount: 180,
    notes: "EXW/FCA: Abholung beim Lieferanten bis Hafen/Terminal",
  },
  {
    id: "lbb_demo_origin",
    name: "Origin Charges / Export",
    phase: "transport",
    allocation: "lump_sum",
    defaultAmount: 150,
    notes: "Dokumentation, Handling am Abgangshafen",
  },
  {
    id: "lbb_demo_ocean",
    name: "Seefracht",
    phase: "transport",
    allocation: "lump_sum",
    defaultAmount: 1850,
    notes: "40' HQ Container, Hauptlauf — nur wenn Käufer den Hauptlauf trägt (z. B. FOB/EXW)",
  },
  {
    id: "lbb_demo_insurance",
    name: "Transportversicherung",
    phase: "transport",
    allocation: "percent_of_goods",
    defaultAmount: 0.4,
    notes:
      "Käuferversicherung (EXW/FOB/CFR/CPT/DAP). Bei CIF/CIP typisch nicht — dort nur Zusatzdeckung.",
  },
  {
    id: "lbb_demo_insurance_topup",
    name: "Zusatzversicherung (über CIF/CIP)",
    phase: "transport",
    allocation: "percent_of_goods",
    defaultAmount: 0.25,
    notes:
      "Optional: höhere Deckung als Verkäufer-Minimum bei CIF/CIP",
  },
  {
    id: "lbb_demo_terminal",
    name: "Terminal / THC",
    phase: "transport",
    allocation: "lump_sum",
    defaultAmount: 220,
    notes: "Zielhafen / Löschen",
  },
  {
    id: "lbb_demo_broker",
    name: "Zollabfertigung / Broker",
    phase: "transport",
    allocation: "lump_sum",
    defaultAmount: 95,
    notes: "Formalitäten Einfuhr (neben Zollabgaben)",
  },
  {
    id: "lbb_demo_duty",
    name: "Zoll",
    phase: "transport",
    allocation: "percent_of_goods",
    defaultAmount: 4.5,
    notes: "Einfuhrzoll — bei DDP oft schon im Lieferpreis",
  },
  {
    id: "lbb_demo_truck",
    name: "Inlandstransport LKW",
    phase: "transport",
    allocation: "lump_sum",
    defaultAmount: 380,
    notes: "Hafen/Grenze → Lager DE",
  },
  {
    id: "lbb_demo_warehouse",
    name: "Lagerumschlag",
    phase: "lager",
    allocation: "per_unit",
    defaultAmount: 0.15,
    notes: "Wareneingang / Handling",
  },
  {
    id: "lbb_demo_eu_truck",
    name: "EU-Straßentransport",
    phase: "transport",
    allocation: "lump_sum",
    defaultAmount: 950,
    notes: "Direktlieferung innerhalb EU",
  },
];

function tplItem(
  id: string,
  buildingBlockId: string,
  amountOverride: number | null = null,
) {
  return { id, buildingBlockId, amountOverride };
}

const LOGISTICS_TEMPLATES: LogisticsTemplate[] = [
  {
    id: "ltpl_demo_exw",
    name: "EXW → DE (Käufer organisiert alles)",
    incoterm: "EXW",
    originCountry: "",
    destinationCountry: "DE",
    supplierId: "",
    notes:
      "Käufer trägt Vorlauf, Hauptlauf, Versicherung, Terminal, Zoll und Inland. Versicherung = Käufer.",
    items: [
      tplItem("lti_exw_1", "lbb_demo_pickup"),
      tplItem("lti_exw_2", "lbb_demo_origin"),
      tplItem("lti_exw_3", "lbb_demo_ocean"),
      tplItem("lti_exw_4", "lbb_demo_insurance"),
      tplItem("lti_exw_5", "lbb_demo_terminal"),
      tplItem("lti_exw_6", "lbb_demo_broker"),
      tplItem("lti_exw_7", "lbb_demo_duty"),
      tplItem("lti_exw_8", "lbb_demo_truck"),
      tplItem("lti_exw_9", "lbb_demo_warehouse"),
    ],
  },
  {
    id: "ltpl_demo_cn_sea",
    name: "FOB → DE (Seefracht ab Schiff)",
    incoterm: "FOB",
    originCountry: "CN",
    destinationCountry: "DE",
    supplierId: "",
    notes:
      "Hauptlauf + Versicherung Käufer. Vorlauf/Verladung typisch Verkäufer. Versicherung = Käufer.",
    items: [
      tplItem("lti_fob_1", "lbb_demo_ocean"),
      tplItem("lti_fob_2", "lbb_demo_insurance"),
      tplItem("lti_fob_3", "lbb_demo_terminal"),
      tplItem("lti_fob_4", "lbb_demo_broker"),
      tplItem("lti_fob_5", "lbb_demo_duty"),
      tplItem("lti_fob_6", "lbb_demo_truck"),
      tplItem("lti_fob_7", "lbb_demo_warehouse"),
    ],
  },
  {
    id: "ltpl_demo_vn_sea",
    name: "FOB VN → DE (Vinh Long)",
    incoterm: "FOB",
    originCountry: "VN",
    destinationCountry: "DE",
    supplierId: "sup_demo_vinh",
    notes:
      "Wie FOB, Seefracht etwas höher. Versicherung = Käufer.",
    items: [
      tplItem("lti_vn_1", "lbb_demo_ocean", 2100),
      tplItem("lti_vn_2", "lbb_demo_insurance"),
      tplItem("lti_vn_3", "lbb_demo_terminal"),
      tplItem("lti_vn_4", "lbb_demo_broker"),
      tplItem("lti_vn_5", "lbb_demo_duty"),
      tplItem("lti_vn_6", "lbb_demo_truck", 420),
      tplItem("lti_vn_7", "lbb_demo_warehouse"),
    ],
  },
  {
    id: "ltpl_demo_cfr",
    name: "CFR → DE (Fracht im Lieferpreis)",
    incoterm: "CFR",
    originCountry: "",
    destinationCountry: "DE",
    supplierId: "",
    notes:
      "Seefracht schon im EK — nicht nochmal. Versicherung weiter Käufer.",
    items: [
      tplItem("lti_cfr_1", "lbb_demo_insurance"),
      tplItem("lti_cfr_2", "lbb_demo_terminal"),
      tplItem("lti_cfr_3", "lbb_demo_broker"),
      tplItem("lti_cfr_4", "lbb_demo_duty"),
      tplItem("lti_cfr_5", "lbb_demo_truck"),
      tplItem("lti_cfr_6", "lbb_demo_warehouse"),
    ],
  },
  {
    id: "ltpl_demo_cif",
    name: "CIF → DE (ohne Zusatzversicherung)",
    incoterm: "CIF",
    originCountry: "",
    destinationCountry: "DE",
    supplierId: "",
    notes:
      "Seefracht + Mindestversicherung im Lieferpreis. Keine Standard-Versicherung — bei Bedarf Vorlage „CIF + Zusatz“.",
    items: [
      tplItem("lti_cif_1", "lbb_demo_terminal"),
      tplItem("lti_cif_2", "lbb_demo_broker"),
      tplItem("lti_cif_3", "lbb_demo_duty"),
      tplItem("lti_cif_4", "lbb_demo_truck"),
      tplItem("lti_cif_5", "lbb_demo_warehouse"),
    ],
  },
  {
    id: "ltpl_demo_cif_topup",
    name: "CIF → DE + Zusatzversicherung",
    incoterm: "CIF",
    originCountry: "",
    destinationCountry: "DE",
    supplierId: "",
    notes:
      "Wie CIF, plus optionale höhere Deckung über Verkäufer-Minimum.",
    items: [
      tplItem("lti_cift_1", "lbb_demo_insurance_topup"),
      tplItem("lti_cift_2", "lbb_demo_terminal"),
      tplItem("lti_cift_3", "lbb_demo_broker"),
      tplItem("lti_cift_4", "lbb_demo_duty"),
      tplItem("lti_cift_5", "lbb_demo_truck"),
      tplItem("lti_cift_6", "lbb_demo_warehouse"),
    ],
  },
  {
    id: "ltpl_demo_cip",
    name: "CIP → DE (ohne Zusatzversicherung)",
    incoterm: "CIP",
    originCountry: "",
    destinationCountry: "DE",
    supplierId: "",
    notes:
      "Hauptlauf + höhere Verkäuferversicherung im Preis. Käufer: oft ab Lieferort Zoll + Letzte Meile.",
    items: [
      tplItem("lti_cip_1", "lbb_demo_broker"),
      tplItem("lti_cip_2", "lbb_demo_duty"),
      tplItem("lti_cip_3", "lbb_demo_truck"),
      tplItem("lti_cip_4", "lbb_demo_warehouse"),
    ],
  },
  {
    id: "ltpl_demo_dap",
    name: "DAP → DE (geliefert, unverzollt)",
    incoterm: "DAP",
    originCountry: "",
    destinationCountry: "DE",
    supplierId: "",
    notes:
      "Transport meist Verkäufer. Käufer: Zoll + Abfertigung + Lager. Versicherung typisch Verkäufer — hier ohne.",
    items: [
      tplItem("lti_dap_1", "lbb_demo_broker"),
      tplItem("lti_dap_2", "lbb_demo_duty"),
      tplItem("lti_dap_3", "lbb_demo_warehouse"),
    ],
  },
  {
    id: "ltpl_demo_ddp",
    name: "DDP → DE (geliefert verzollt)",
    incoterm: "DDP",
    originCountry: "",
    destinationCountry: "DE",
    supplierId: "",
    notes:
      "Fast alles im Lieferpreis inkl. Zoll. Nur Lagerumschlag als typischer Restkostenblock.",
    items: [tplItem("lti_ddp_1", "lbb_demo_warehouse")],
  },
  {
    id: "ltpl_demo_eu_truck",
    name: "EXW EU Truck Direct",
    incoterm: "EXW",
    originCountry: "",
    destinationCountry: "DE",
    supplierId: "",
    notes:
      "EU-Straße statt See. Versicherung = Käufer.",
    items: [
      tplItem("lti_eu_1", "lbb_demo_eu_truck"),
      tplItem("lti_eu_2", "lbb_demo_insurance"),
      tplItem("lti_eu_3", "lbb_demo_warehouse"),
    ],
  },
];

function costItemsFromTemplate(
  batchKey: string,
  template: LogisticsTemplate,
  blocks: LogisticsBuildingBlock[],
): CostItem[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const out: CostItem[] = [];
  for (const item of template.items) {
    const block = byId.get(item.buildingBlockId);
    if (!block) continue;
    const amount =
      item.amountOverride != null
        ? item.amountOverride
        : (block.defaultAmount ?? 0);
    out.push({
      id: `cost_${batchKey}_${item.id}`,
      type: block.name,
      label: block.name,
      amount,
      allocation: block.allocation,
      phase: block.phase,
    });
  }
  return out;
}

function sale(partial: Omit<Sale, "channel"> & { channel?: Sale["channel"] }): Sale {
  return {
    channel: "",
    ...partial,
  };
}

const tplById = Object.fromEntries(
  LOGISTICS_TEMPLATES.map((t) => [t.id, t]),
) as Record<string, LogisticsTemplate>;

type FgBatchSpec = {
  id: string;
  product: "lounge" | "bike" | "xmas";
  label: string;
  quantity: number;
  orderDate: string;
  /** null = bestellt (kein ETA) */
  expectedArrivalDate: string | null;
  /** null = noch nicht angekommen */
  arrivalDate: string | null;
  soldQuantity?: number;
  soldDate?: string | null;
  notes: string;
  poNumber: string;
};

const FG_META = {
  lounge: {
    productId: "prd_demo_lounge",
    supplierId: "sup_demo_vinh",
    dealerId: "dlr_demo_gartenwelt",
    channel: "b2b" as const,
    incoterm: "FOB" as const,
    templateId: "ltpl_demo_vn_sea",
  },
  bike: {
    productId: "prd_demo_bike",
    supplierId: "sup_demo_ningbo",
    dealerId: "dlr_demo_bikestop",
    channel: "retail" as const,
    incoterm: "FOB" as const,
    templateId: "ltpl_demo_cn_sea",
  },
  xmas: {
    productId: "prd_demo_xmas",
    supplierId: "sup_demo_yiwu",
    dealerId: "dlr_demo_saison",
    channel: "marketplace" as const,
    incoterm: "CIF" as const,
    templateId: "ltpl_demo_cif",
  },
};

function fgBatch(spec: FgBatchSpec): Batch {
  const meta = FG_META[spec.product];
  const soldQty = spec.soldQuantity ?? 0;
  const arrived = Boolean(spec.arrivalDate);
  return {
    id: spec.id,
    productId: meta.productId,
    supplierId: meta.supplierId,
    label: spec.label,
    quantity: spec.quantity,
    unitPurchasePrice: null,
    currency: null,
    paymentDays: null,
    paymentUnit: null,
    skontoPercent: null,
    skontoDays: null,
    incoterm: meta.incoterm,
    costItems: costItemsFromTemplate(
      spec.id.replace(/^bat_demo_/, ""),
      tplById[meta.templateId],
      LOGISTICS_BLOCKS,
    ),
    sales: [
      sale({
        id: `${spec.id}_sale`,
        dealerId: meta.dealerId,
        salePricePerUnit: null,
        quantity: soldQty,
        channel: meta.channel,
        costItems: null,
      }),
    ],
    orderDate: spec.orderDate,
    arrivalDate: spec.arrivalDate,
    expectedArrivalDate: spec.expectedArrivalDate,
    poNumber: spec.poNumber,
    notes: spec.notes,
    receivedQuantity: arrived ? spec.quantity : null,
    soldDate: spec.soldDate ?? null,
    applySkonto: null,
    fxRateOverride: null,
    duty: { hsCode: "", countryOfOrigin: "", ratePercent: 0, fixedAmount: 0 },
    quotes: [],
    activeQuoteId: null,
    createdAt: `${spec.orderDate}T10:00:00.000Z`,
  };
}

/**
 * Fertigware-Pipeline (Stand 2026-08-22):
 * je 4× bestellt / unterwegs / im Lager (+ 1 verkauft).
 * Einzelteil-Chargen liegen separat in PART_BATCHES.
 */
const BATCHES: Batch[] = [
  // —— Bestellt (kein ETA, keine Ist-Ankunft) ——
  fgBatch({
    id: "bat_demo_ord_lounge",
    product: "lounge",
    label: "Lounge — PO neu HCMC",
    quantity: 30,
    orderDate: "2026-08-18",
    expectedArrivalDate: null,
    arrivalDate: null,
    poNumber: "PO-VN-2618",
    notes: "Frisch bestellt, ETA noch offen",
  }),
  fgBatch({
    id: "bat_demo_ord_bike",
    product: "bike",
    label: "Bike-Acc — Ningbo Nachorder",
    quantity: 1500,
    orderDate: "2026-08-19",
    expectedArrivalDate: null,
    arrivalDate: null,
    poNumber: "PO-CN-2619",
    notes: "Bestätigt, Abfahrtstermin ausstehend",
  }),
  fgBatch({
    id: "bat_demo_ord_xmas",
    product: "xmas",
    label: "Xmas-Set — Nachorder Aug",
    quantity: 2500,
    orderDate: "2026-08-20",
    expectedArrivalDate: null,
    arrivalDate: null,
    poNumber: "PO-YW-2620",
    notes: "Saison-Nachorder",
  }),
  fgBatch({
    id: "bat_demo_ord_bike_2",
    product: "bike",
    label: "Bike-Acc — Express-PO",
    quantity: 800,
    orderDate: "2026-08-21",
    expectedArrivalDate: null,
    arrivalDate: null,
    poNumber: "PO-CN-2621",
    notes: "Kleine Express-Charge",
  }),

  // —— Unterwegs (ETA gesetzt, noch keine Ist-Ankunft) ——
  fgBatch({
    id: "bat_demo_trn_lounge",
    product: "lounge",
    label: "Lounge — Container unterwegs",
    quantity: 40,
    orderDate: "2026-07-20",
    expectedArrivalDate: "2026-09-05",
    arrivalDate: null,
    poNumber: "PO-VN-2607",
    notes: "Seefracht, ETA Hamburg",
  }),
  fgBatch({
    id: "bat_demo_trn_bike",
    product: "bike",
    label: "Bike-Acc — Ningbo Sea",
    quantity: 2200,
    orderDate: "2026-07-28",
    expectedArrivalDate: "2026-09-12",
    arrivalDate: null,
    poNumber: "PO-CN-2607",
    notes: "Unterwegs FOB Ningbo",
  }),
  fgBatch({
    id: "bat_demo_trn_xmas",
    product: "xmas",
    label: "Xmas-Set — CIF Transit",
    quantity: 4000,
    orderDate: "2026-08-01",
    expectedArrivalDate: "2026-09-18",
    arrivalDate: null,
    poNumber: "PO-YW-2608",
    notes: "CIF, Ankunft geplant Sept",
  }),
  fgBatch({
    id: "bat_demo_trn_lounge_2",
    product: "lounge",
    label: "Lounge — 2. Container",
    quantity: 25,
    orderDate: "2026-08-05",
    expectedArrivalDate: "2026-09-25",
    arrivalDate: null,
    poNumber: "PO-VN-2608b",
    notes: "Nachzieh-Container",
  }),

  // —— Im Lager (Ist-Ankunft ≤ heute) ——
  fgBatch({
    id: "bat_demo_arr_lounge",
    product: "lounge",
    label: "Lounge Q3 — Container HCMC",
    quantity: 40,
    orderDate: "2026-07-10",
    expectedArrivalDate: "2026-08-15",
    arrivalDate: "2026-08-18",
    poNumber: "PO-VN-2608",
    notes: "Eingetroffen",
  }),
  fgBatch({
    id: "bat_demo_arr_bike",
    product: "bike",
    label: "Bike-Acc Q3 — Ningbo",
    quantity: 2000,
    orderDate: "2026-05-20",
    expectedArrivalDate: "2026-06-10",
    arrivalDate: "2026-06-12",
    poNumber: "PO-CN-2605",
    notes: "Im Lager",
  }),
  fgBatch({
    id: "bat_demo_arr_xmas",
    product: "xmas",
    label: "Xmas-Set — Hauptsaison",
    quantity: 5000,
    orderDate: "2026-05-15",
    expectedArrivalDate: "2026-06-28",
    arrivalDate: "2026-07-01",
    soldQuantity: 1800,
    poNumber: "PO-YW-2605",
    notes: "Teilverkauf angelaufen",
  }),
  fgBatch({
    id: "bat_demo_arr_xmas_early",
    product: "xmas",
    label: "Xmas-Set — Vororder Mai",
    quantity: 2000,
    orderDate: "2026-03-20",
    expectedArrivalDate: "2026-05-01",
    arrivalDate: "2026-05-02",
    soldQuantity: 400,
    poNumber: "PO-YW-2603",
    notes: "Frühe Saisonware",
  }),

  // —— Verkauft (nicht in offenen Filtern) ——
  fgBatch({
    id: "bat_demo_lounge_sold",
    product: "lounge",
    label: "Lounge Q2 — verkauft",
    quantity: 20,
    orderDate: "2026-03-01",
    expectedArrivalDate: "2026-04-18",
    arrivalDate: "2026-04-20",
    soldQuantity: 20,
    soldDate: "2026-06-12",
    poNumber: "PO-VN-2603",
    notes: "Abverkauft",
  }),
];

function partBatch(partial: {
  id: string;
  productId: string;
  supplierId: string;
  label: string;
  quantity: number;
  unitPurchasePrice: number;
  orderDate: string;
  arrivalDate: string;
  expectedArrivalDate?: string;
}): Batch {
  return {
    id: partial.id,
    productId: partial.productId,
    supplierId: partial.supplierId,
    label: partial.label,
    quantity: partial.quantity,
    unitPurchasePrice: partial.unitPurchasePrice,
    currency: "USD",
    paymentDays: null,
    paymentUnit: null,
    skontoPercent: null,
    skontoDays: null,
    incoterm: "FOB",
    costItems: [],
    sales: [
      sale({
        id: `${partial.id}_sale`,
        dealerId: null,
        salePricePerUnit: 0,
        quantity: 0,
        channel: "",
        costItems: [],
      }),
    ],
    orderDate: partial.orderDate,
    arrivalDate: partial.arrivalDate,
    expectedArrivalDate: partial.expectedArrivalDate ?? partial.arrivalDate,
    poNumber: partial.id.replace("bat_part_", "PO-PART-").toUpperCase(),
    notes: "Einzelteil-Wareneingang",
    receivedQuantity: partial.quantity,
    soldDate: null,
    applySkonto: false,
    fxRateOverride: null,
    duty: { hsCode: "", countryOfOrigin: "", ratePercent: 0, fixedAmount: 0 },
    quotes: [],
    activeQuoteId: null,
    createdAt: `${partial.orderDate}T10:00:00.000Z`,
  };
}

/** Bestellungen / Wareneingänge der Einzelteile */
const PART_BATCHES: Batch[] = [
  partBatch({
    id: "bat_part_led_1",
    productId: "prd_stock_led",
    supplierId: "sup_demo_ningbo",
    label: "LED — Ningbo Apr",
    quantity: 3000,
    unitPurchasePrice: 1.85,
    orderDate: "2026-03-15",
    arrivalDate: "2026-04-10",
  }),
  partBatch({
    id: "bat_part_led_2",
    productId: "prd_stock_led",
    supplierId: "sup_demo_ningbo",
    label: "LED — Ningbo Jun",
    quantity: 2500,
    unitPurchasePrice: 1.8,
    orderDate: "2026-05-20",
    arrivalDate: "2026-06-18",
  }),
  partBatch({
    id: "bat_part_bell_1",
    productId: "prd_stock_bell",
    supplierId: "sup_demo_ningbo",
    label: "Klingel — Ningbo Mai",
    quantity: 4000,
    unitPurchasePrice: 0.65,
    orderDate: "2026-04-01",
    arrivalDate: "2026-05-05",
  }),
  partBatch({
    id: "bat_part_ornament_1",
    productId: "prd_stock_ornament",
    supplierId: "sup_demo_yiwu",
    label: "Ornament — Yiwu Mär",
    quantity: 12000,
    unitPurchasePrice: 0.32,
    orderDate: "2026-02-20",
    arrivalDate: "2026-03-28",
  }),
  partBatch({
    id: "bat_part_ornament_2",
    productId: "prd_stock_ornament",
    supplierId: "sup_demo_yiwu",
    label: "Ornament — Yiwu Jun",
    quantity: 15000,
    unitPurchasePrice: 0.3,
    orderDate: "2026-05-10",
    arrivalDate: "2026-06-22",
  }),
  partBatch({
    id: "bat_part_sofa_1",
    productId: "prd_stock_sofa",
    supplierId: "sup_demo_vinh",
    label: "Sofa — Vinh Apr",
    quantity: 80,
    unitPurchasePrice: 95,
    orderDate: "2026-03-01",
    arrivalDate: "2026-04-22",
  }),
  partBatch({
    id: "bat_part_sofa_2",
    productId: "prd_stock_sofa",
    supplierId: "sup_demo_vinh",
    label: "Sofa — Vinh Jul",
    quantity: 60,
    unitPurchasePrice: 92,
    orderDate: "2026-06-01",
    arrivalDate: "2026-07-15",
  }),
  partBatch({
    id: "bat_part_table_1",
    productId: "prd_stock_table",
    supplierId: "sup_demo_vinh",
    label: "Tisch — Vinh Mai",
    quantity: 100,
    unitPurchasePrice: 48,
    orderDate: "2026-04-05",
    arrivalDate: "2026-05-20",
  }),
];

const OVERHEAD: OverheadItem[] = [
  {
    id: "oh_demo_warehouse",
    name: "Lagermiete Halle Süd",
    betrag: 3200,
    waehrung: "EUR",
    periode: "monatlich",
    kategorie: "lagerungsgemeinkosten",
    kostenart: "fix",
    variableBasis: null,
    variableRate: null,
    verteilschluessel: "nach_stueckzahl",
    manuelleAufteilung: null,
    gueltigVon: null,
    gueltigBis: null,
    createdAt: NOW,
    updatedAt: NOW,
    updatedBy: null,
  },
  {
    id: "oh_demo_warehouse_staff",
    name: "Lagerpersonal (Wareneingang)",
    betrag: 4800,
    waehrung: "EUR",
    periode: "monatlich",
    kategorie: "lagerungsgemeinkosten",
    kostenart: "fix",
    variableBasis: null,
    variableRate: null,
    verteilschluessel: "nach_stueckzahl",
    manuelleAufteilung: null,
    gueltigVon: null,
    gueltigBis: null,
    createdAt: NOW,
    updatedAt: NOW,
    updatedBy: null,
  },
];

const PERSONNEL_TEAMS: PersonnelTeam[] = [
  {
    id: "ptm_demo_lead",
    name: "Geschäftsführung",
    notes: "Leitung & Strategie",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "ptm_demo_ops",
    name: "Operations",
    notes: "Einkauf, Logistik, Supply Chain",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "ptm_demo_sales",
    name: "Sales",
    notes: "Key Accounts & Innendienst",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "ptm_demo_marketing",
    name: "Marketing",
    notes: "Brand, Content, Performance",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "ptm_demo_cs",
    name: "Customer Success",
    notes: "Händlerbetreuung & After-Sales",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "ptm_demo_finance",
    name: "Finance",
    notes: "Controlling & Buchhaltung",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

function personnelDeps(prefix: string): PersonnelRole["dependencies"] {
  return [
    {
      id: `${prefix}_laptop`,
      name: "Laptop",
      amount: 1200,
      cadence: "einmalig",
      scalesWithHeadcount: true,
    },
    {
      id: `${prefix}_desk`,
      name: "Büroplatz",
      amount: 350,
      cadence: "monatlich",
      scalesWithHeadcount: true,
    },
    {
      id: `${prefix}_onboard`,
      name: "Onboarding / Vertrag",
      amount: 400,
      cadence: "einmalig",
      scalesWithHeadcount: true,
    },
  ];
}

function personnelRole(
  partial: Omit<PersonnelRole, "createdAt" | "updatedAt" | "updatedBy" | "notes"> & {
    notes?: string;
  },
): PersonnelRole {
  return {
    ...partial,
    notes: partial.notes ?? "",
    createdAt: NOW,
    updatedAt: NOW,
    updatedBy: null,
  };
}

const PERSONNEL: PersonnelRole[] = [
  personnelRole({
    id: "prs_demo_ceo",
    name: "Geschäftsführer",
    teamId: "ptm_demo_lead",
    bruttoGehalt: 9200,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "single",
    headcount: 1,
    hiresPerPeriod: 1,
    hireFrequency: "once",
    maxHeadcount: null,
    waehrung: "EUR",
    kategorie: "verwaltungsgemeinkosten",
    verteilschluessel: "gleichmaessig",
    manuelleAufteilung: null,
    dependencies: personnelDeps("pdep_demo_ceo"),
    gueltigVon: "2025-01-01",
    gueltigBis: null,
    notes: "Gesamtverantwortung Marginlane Demo",
  }),
  personnelRole({
    id: "prs_demo_ops_lead",
    name: "Head of Operations",
    teamId: "ptm_demo_ops",
    bruttoGehalt: 6500,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "single",
    headcount: 1,
    hiresPerPeriod: 1,
    hireFrequency: "once",
    maxHeadcount: null,
    waehrung: "EUR",
    kategorie: "verwaltungsgemeinkosten",
    verteilschluessel: "nach_stueckzahl",
    manuelleAufteilung: null,
    dependencies: personnelDeps("pdep_demo_ops_lead"),
    gueltigVon: "2025-01-01",
    gueltigBis: null,
    notes: "Supply Chain, Einkauf, Lagerprozesse",
  }),
  personnelRole({
    id: "prs_demo_ops",
    name: "Einkäufer Asia",
    teamId: "ptm_demo_ops",
    bruttoGehalt: 4800,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "scaling",
    headcount: 2,
    hiresPerPeriod: 1,
    hireFrequency: "yearly",
    maxHeadcount: 5,
    waehrung: "EUR",
    kategorie: "verwaltungsgemeinkosten",
    verteilschluessel: "nach_stueckzahl",
    manuelleAufteilung: null,
    dependencies: [
      ...personnelDeps("pdep_demo_ops"),
      {
        id: "pdep_demo_ops_travel",
        name: "Sourcing-Reise Asien",
        amount: 2800,
        cadence: "einmalig",
        scalesWithHeadcount: true,
      },
    ],
    gueltigVon: "2025-01-01",
    gueltigBis: null,
    notes: "Skalierung: +1 Einkäufer/Jahr bis max. 5 (VN/CN-Lieferanten)",
  }),
  personnelRole({
    id: "prs_demo_logistics",
    name: "Logistikkoordinator",
    teamId: "ptm_demo_ops",
    bruttoGehalt: 3900,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "single",
    headcount: 1,
    hiresPerPeriod: 1,
    hireFrequency: "once",
    maxHeadcount: null,
    waehrung: "EUR",
    kategorie: "fertigungsgemeinkosten",
    verteilschluessel: "nach_stueckzahl",
    manuelleAufteilung: null,
    dependencies: personnelDeps("pdep_demo_logistics"),
    gueltigVon: "2025-03-01",
    gueltigBis: null,
    notes: "Container, Zoll, Wareneingang",
  }),
  personnelRole({
    id: "prs_demo_kam",
    name: "Key Account Manager",
    teamId: "ptm_demo_sales",
    bruttoGehalt: 5400,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "scaling",
    headcount: 2,
    hiresPerPeriod: 1,
    hireFrequency: "yearly",
    maxHeadcount: 5,
    waehrung: "EUR",
    kategorie: "vertriebsgemeinkosten",
    verteilschluessel: "nach_umsatzanteil",
    manuelleAufteilung: null,
    dependencies: [
      ...personnelDeps("pdep_demo_kam"),
      {
        id: "pdep_demo_kam_car",
        name: "Firmenwagen-Pauschale",
        amount: 450,
        cadence: "monatlich",
        scalesWithHeadcount: true,
      },
      {
        id: "pdep_demo_kam_phone",
        name: "Diensthandy",
        amount: 45,
        cadence: "monatlich",
        scalesWithHeadcount: true,
      },
    ],
    gueltigVon: "2025-01-01",
    gueltigBis: null,
    notes: "Skalierung: +1 KAM/Jahr bis max. 5 — Firmenwagen inkl.",
  }),
  personnelRole({
    id: "prs_demo_sales",
    name: "Vertrieb Innendienst",
    teamId: "ptm_demo_sales",
    bruttoGehalt: 3800,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "scaling",
    headcount: 3,
    hiresPerPeriod: 1,
    hireFrequency: "quarterly",
    maxHeadcount: 9,
    waehrung: "EUR",
    kategorie: "vertriebsgemeinkosten",
    verteilschluessel: "nach_umsatzanteil",
    manuelleAufteilung: null,
    dependencies: [
      ...personnelDeps("pdep_demo_sales"),
      {
        id: "pdep_demo_sales_headset",
        name: "Headset / Softphone",
        amount: 25,
        cadence: "monatlich",
        scalesWithHeadcount: true,
      },
    ],
    gueltigVon: "2025-01-01",
    gueltigBis: null,
    notes: "Skalierung: +1 Person/Quartal bis max. 9 (Auftragsvolumen)",
  }),
  personnelRole({
    id: "prs_demo_mkt_lead",
    name: "Marketing Manager",
    teamId: "ptm_demo_marketing",
    bruttoGehalt: 4700,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "single",
    headcount: 1,
    hiresPerPeriod: 1,
    hireFrequency: "once",
    maxHeadcount: null,
    waehrung: "EUR",
    kategorie: "vertriebsgemeinkosten",
    verteilschluessel: "nach_umsatzanteil",
    manuelleAufteilung: null,
    dependencies: personnelDeps("pdep_demo_mkt_lead"),
    gueltigVon: "2025-02-01",
    gueltigBis: null,
    notes: "Kampagnen, Messen, Markenauftritt",
  }),
  personnelRole({
    id: "prs_demo_mkt_perf",
    name: "Performance Marketing",
    teamId: "ptm_demo_marketing",
    bruttoGehalt: 4100,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "scaling",
    headcount: 1,
    hiresPerPeriod: 1,
    hireFrequency: "yearly",
    maxHeadcount: 3,
    waehrung: "EUR",
    kategorie: "vertriebsgemeinkosten",
    verteilschluessel: "nach_umsatzanteil",
    manuelleAufteilung: null,
    dependencies: [
      ...personnelDeps("pdep_demo_mkt_perf"),
      {
        id: "pdep_demo_mkt_tools",
        name: "Ad-Tools / Analytics",
        amount: 120,
        cadence: "monatlich",
        scalesWithHeadcount: true,
      },
    ],
    gueltigVon: "2025-06-01",
    gueltigBis: null,
    notes: "Skalierung: +1 Specialist/Jahr bis max. 3 (SEA/Social)",
  }),
  personnelRole({
    id: "prs_demo_cs",
    name: "Customer Success Manager",
    teamId: "ptm_demo_cs",
    bruttoGehalt: 4200,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "scaling",
    headcount: 2,
    hiresPerPeriod: 1,
    hireFrequency: "yearly",
    maxHeadcount: 5,
    waehrung: "EUR",
    kategorie: "vertriebsgemeinkosten",
    verteilschluessel: "nach_umsatzanteil",
    manuelleAufteilung: null,
    dependencies: [
      ...personnelDeps("pdep_demo_cs"),
      {
        id: "pdep_demo_cs_crm",
        name: "CRM-Seat",
        amount: 55,
        cadence: "monatlich",
        scalesWithHeadcount: true,
      },
    ],
    gueltigVon: "2025-04-01",
    gueltigBis: null,
    notes: "Skalierung: +1 CSM/Jahr bis max. 5 mit Händlerwachstum",
  }),
  personnelRole({
    id: "prs_demo_controller",
    name: "Controller",
    teamId: "ptm_demo_finance",
    bruttoGehalt: 5200,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "single",
    headcount: 1,
    hiresPerPeriod: 1,
    hireFrequency: "once",
    maxHeadcount: null,
    waehrung: "EUR",
    kategorie: "verwaltungsgemeinkosten",
    verteilschluessel: "gleichmaessig",
    manuelleAufteilung: null,
    dependencies: personnelDeps("pdep_demo_controller"),
    gueltigVon: "2025-01-01",
    gueltigBis: null,
    notes: "Deckungsbeiträge, Forecast, Preisgestaltung",
  }),
  personnelRole({
    id: "prs_demo_accounting",
    name: "Buchhaltung",
    teamId: "ptm_demo_finance",
    bruttoGehalt: 3600,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 0,
    benefitsMonthly: 0,
    annualIncreasePercent: 3,
    roleType: "single",
    headcount: 1,
    hiresPerPeriod: 1,
    hireFrequency: "once",
    maxHeadcount: null,
    waehrung: "EUR",
    kategorie: "verwaltungsgemeinkosten",
    verteilschluessel: "gleichmaessig",
    manuelleAufteilung: null,
    dependencies: personnelDeps("pdep_demo_accounting"),
    gueltigVon: "2025-01-01",
    gueltigBis: null,
    notes: "Kreditoren, Debitoren, USt",
  }),
];

const DEALERS: Dealer[] = [
  {
    id: "dlr_demo_gartenwelt",
    name: "GartenWelt Süd GmbH",
    country: "DE",
    contactName: "Einkauf",
    email: "einkauf@gartenwelt-sued.de",
    phone: "",
    channel: "b2b",
    paymentTerms: "30 Tage",
    currency: "EUR",
    defaultSellPrice: 249,
    salesCostItems: [
      cost(createId("cost"), "Provision", 5, "percent_of_goods"),
    ],
    status: "active",
    notes: "Standard-VK für Gartenmöbel-Set. Kanal: Großhandel/B2B stationär.",
    createdAt: NOW,
  },
  {
    id: "dlr_demo_saison",
    name: "SaisonShop24 (Online-Marktplatz)",
    country: "DE",
    contactName: "",
    email: "",
    phone: "",
    channel: "marketplace",
    paymentTerms: "14 Tage",
    currency: "EUR",
    defaultSellPrice: 12.9,
    salesCostItems: [
      cost(createId("cost"), "Plattformgebühr", 15, "percent_of_goods"),
      cost(createId("cost"), "Versand", 2.5, "per_unit"),
    ],
    status: "active",
    notes: "Standard-VK für Deko-Sets. Online-Marktplatz (Amazon/eigener Shop).",
    createdAt: NOW,
  },
  {
    id: "dlr_demo_bikestop",
    name: "BikeStop Fahrradfachhandel eG",
    country: "DE",
    contactName: "",
    email: "",
    phone: "",
    channel: "retail",
    paymentTerms: "30 Tage",
    currency: "EUR",
    defaultSellPrice: 8.5,
    salesCostItems: [
      cost(createId("cost"), "Provision", 8, "percent_of_goods"),
    ],
    status: "inactive",
    notes: "Aktuell pausiert, Vertrag läuft im Q1 wieder an. Fachhandel B2B.",
    createdAt: NOW,
  },
];

function upsertById<T extends { id: string }>(
  existing: T[],
  incoming: T[],
): T[] {
  const map = new Map(existing.map((row) => [row.id, row]));
  for (const row of incoming) {
    map.set(row.id, row);
  }
  return [...map.values()];
}

/** Demo-Produkte per SKU mergen: gleiche SKU → Demo-Eintrag gewinnt, Duplikat raus. */
function upsertProductsBySku(
  existing: CatalogProduct[],
  incoming: CatalogProduct[],
): { products: CatalogProduct[]; removedIds: string[] } {
  const removedIds: string[] = [];
  const byId = new Map(existing.map((p) => [p.id, p]));
  const skuOwner = new Map<string, string>();

  for (const p of existing) {
    const key = p.sku.trim().toLowerCase();
    if (key) skuOwner.set(key, p.id);
  }

  for (const row of incoming) {
    const key = row.sku.trim().toLowerCase();
    if (key) {
      const prevId = skuOwner.get(key);
      if (prevId && prevId !== row.id) {
        removedIds.push(prevId);
        byId.delete(prevId);
      }
      skuOwner.set(key, row.id);
    }
    byId.set(row.id, row);
  }

  return { products: [...byId.values()], removedIds };
}

const seedFgBatchIds = new Set(BATCHES.map((b) => b.id));

async function buildDemoData(current: AppData): Promise<{
  next: AppData;
  removedIds: string[];
}> {
  const { products, removedIds } = upsertProductsBySku(
    current.catalogProducts,
    [...PRODUCTS, ...PART_PRODUCTS],
  );

  const next: AppData = {
    ...current,
    suppliers: upsertById(current.suppliers, SUPPLIERS),
    catalogProducts: products,
    components: upsertById(current.components, COMPONENTS),
    productComponents: upsertById(
      (current.productComponents ?? []).filter(
        (pc) => !removedIds.includes(pc.productId),
      ),
      LINKS,
    ),
    productSuppliers: upsertById(
      (current.productSuppliers ?? []).filter(
        (ps) => !removedIds.includes(ps.productId),
      ),
      PRODUCT_SUPPLIERS,
    ),
    dealers: upsertById(current.dealers, DEALERS),
    logisticsBuildingBlocks: upsertById(
      current.logisticsBuildingBlocks ?? [],
      LOGISTICS_BLOCKS,
    ),
    logisticsTemplates: upsertById(
      current.logisticsTemplates ?? [],
      LOGISTICS_TEMPLATES,
    ),
    batches: upsertById(
      current.batches.filter((b) => {
        if (removedIds.includes(b.productId)) return false;
        // Veraltete Demo-Fertigware-IDs entfernen (Pipeline-Seed ersetzt sie)
        if (b.id.startsWith("bat_demo_") && !seedFgBatchIds.has(b.id)) {
          return false;
        }
        return true;
      }),
      [...BATCHES, ...PART_BATCHES],
    ),
    overheadItems: upsertById(current.overheadItems ?? [], OVERHEAD),
    personnelTeams: upsertById(current.personnelTeams ?? [], PERSONNEL_TEAMS),
    personnelRoles: upsertById(current.personnelRoles ?? [], PERSONNEL),
    companySettings: {
      ...(current.companySettings ?? {}),
      companyName:
        current.companySettings?.companyName?.trim() || "Athenik",
      baseCurrency: current.companySettings?.baseCurrency || "EUR",
      modelStartMonth:
        current.companySettings?.modelStartMonth || "2025-01",
      lastActualMonth:
        current.companySettings?.lastActualMonth || "2030-12",
    },
    salesPlan: (current.salesPlan ?? []).filter(
      (c) => !removedIds.includes(c.productId),
    ),
    salesPlanRowMeta: (current.salesPlanRowMeta ?? []).filter(
      (m) => !removedIds.includes(m.productId),
    ),
  };

  return { next, removedIds };
}

async function main() {
  const targets = ["default", "default-batches"] as const;

  for (const id of targets) {
    const workspace = await getWorkspace(id);
    if (!workspace) {
      console.warn(`Workspace ${id} fehlt — überspringe`);
      continue;
    }
    const { next, removedIds } = await buildDemoData(workspace.data);
    const saved = await saveWorkspaceData(id, next);
    if (removedIds.length) {
      console.log(`[${id}] SKU-Duplikate entfernt:`, removedIds.join(", "));
    }
    console.log(`[${id}] Demo-Stammdaten geschrieben:`);
    console.log(
      `  Lieferanten: ${SUPPLIERS.length} (gesamt ${saved.suppliers.length})`,
    );
    console.log(
      `  Produkte:    ${PRODUCTS.length} (gesamt ${saved.catalogProducts.length})`,
    );
    console.log(
      `  Komponenten: ${COMPONENTS.length} (gesamt ${saved.components.length})`,
    );
    console.log(
      `  BOM-Links:   ${LINKS.length} (gesamt ${saved.productComponents.length})`,
    );
    console.log(
      `  Produkt↔LF:  ${PRODUCT_SUPPLIERS.length} (gesamt ${(saved.productSuppliers ?? []).length})`,
    );
    console.log(`  Händler:     ${DEALERS.length} (gesamt ${saved.dealers.length})`);
    console.log(
      `  Logistik:    ${LOGISTICS_BLOCKS.length} Bausteine, ${LOGISTICS_TEMPLATES.length} Vorlagen`,
    );
    console.log(`  Chargen:     ${BATCHES.length} (gesamt ${saved.batches.length})`);
    console.log(
      `  Overhead:    ${OVERHEAD.length} (gesamt ${saved.overheadItems.length})`,
    );
    console.log(
      `  Personal:    ${PERSONNEL.length} Rollen, ${PERSONNEL_TEAMS.length} Teams (gesamt ${(saved.personnelRoles ?? []).length} / ${(saved.personnelTeams ?? []).length})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

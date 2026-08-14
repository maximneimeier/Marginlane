/**
 * Demo-Stammdaten in den default-Workspace schreiben (idempotent per fester IDs).
 *
 * Usage: npx tsx scripts/seed-demo-masterdata.ts
 */
import "dotenv/config";
import { createId } from "../src/lib/format";
import {
  getWorkspaceData,
  saveWorkspaceData,
} from "../src/lib/db/workspace";
import type {
  AppData,
  CatalogProduct,
  Component,
  CostItem,
  Dealer,
  LogisticsBuildingBlock,
  LogisticsTemplate,
  ProductComponent,
  ProductDocument,
  Supplier,
} from "../src/lib/types";
import { formatPaymentTerms } from "../src/lib/types";

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

const COMPONENTS: Component[] = [
  {
    id: "cmp_demo_led",
    supplierId: "sup_demo_ningbo",
    name: "LED-Frontlicht USB-C",
    sku: "LRP-LED-001",
    currency: "USD",
    purchasePricePerUnit: 1.85,
    notes: "Wasserdicht IPX4",
  },
  {
    id: "cmp_demo_bell",
    supplierId: "sup_demo_ningbo",
    name: "Fahrradklingel Aluminium",
    sku: "LRP-BELL-002",
    currency: "USD",
    purchasePricePerUnit: 0.65,
    notes: "",
  },
  {
    id: "cmp_demo_mount",
    supplierId: "sup_demo_ningbo",
    name: "Universal-Halterung Lenker",
    sku: "LRP-MNT-003",
    currency: "USD",
    purchasePricePerUnit: 0.4,
    notes: "Passend zu LED und Klingel",
  },
  {
    id: "cmp_demo_ornament",
    supplierId: "sup_demo_yiwu",
    name: "Glaskugel-Ornament 6cm rot",
    sku: "YST-ORN-RED6",
    currency: "USD",
    purchasePricePerUnit: 0.32,
    notes: "12er-Bündel beim Lieferanten, EK ist Einzelpreis",
  },
  {
    id: "cmp_demo_ribbon",
    supplierId: "",
    name: "Geschenkband Satin 2m",
    sku: "",
    currency: "USD",
    purchasePricePerUnit: 0.18,
    notes: "Preis vorläufig geschätzt, Angebot ausstehend",
  },
  {
    id: "cmp_demo_card",
    supplierId: "sup_demo_yiwu",
    name: "Grußkarte Weihnachten",
    sku: "YST-CARD-XMAS",
    currency: "USD",
    purchasePricePerUnit: 0.12,
    notes: "Zweisprachig DE/EN",
  },
  {
    id: "cmp_demo_sofa",
    supplierId: "sup_demo_vinh",
    name: "Lounge-Sofa Rattan",
    sku: "VLF-SOFA-01",
    currency: "USD",
    purchasePricePerUnit: 95,
    notes: "Hauptteil des Sets",
  },
  {
    id: "cmp_demo_table",
    supplierId: "sup_demo_vinh",
    name: "Beistelltisch Holz",
    sku: "VLF-TBL-01",
    currency: "USD",
    purchasePricePerUnit: 48,
    notes: "",
  },
  {
    id: "cmp_demo_cushion",
    supplierId: "sup_demo_vinh",
    name: "Outdoor-Kissen",
    sku: "VLF-CUSH-01",
    currency: "USD",
    purchasePricePerUnit: 23,
    notes: "2 Stück pro Set",
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

async function main() {
  const current = await getWorkspaceData();
  const { products, removedIds } = upsertProductsBySku(
    current.catalogProducts,
    PRODUCTS,
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
    dealers: upsertById(current.dealers, DEALERS),
    logisticsBuildingBlocks: upsertById(
      current.logisticsBuildingBlocks ?? [],
      LOGISTICS_BLOCKS,
    ),
    logisticsTemplates: upsertById(
      current.logisticsTemplates ?? [],
      LOGISTICS_TEMPLATES,
    ),
    batches: current.batches.filter((b) => !removedIds.includes(b.productId)),
    salesPlan: (current.salesPlan ?? []).filter(
      (c) => !removedIds.includes(c.productId),
    ),
    salesPlanRowMeta: (current.salesPlanRowMeta ?? []).filter(
      (m) => !removedIds.includes(m.productId),
    ),
  };

  const saved = await saveWorkspaceData(next);

  if (removedIds.length) {
    console.log("SKU-Duplikate entfernt:", removedIds.join(", "));
  }
  console.log("Demo-Stammdaten geschrieben:");
  console.log(`  Lieferanten: ${SUPPLIERS.length} (gesamt ${saved.suppliers.length})`);
  console.log(`  Produkte:    ${PRODUCTS.length} (gesamt ${saved.catalogProducts.length})`);
  console.log(`  Komponenten: ${COMPONENTS.length} (gesamt ${saved.components.length})`);
  console.log(
    `  BOM-Links:   ${LINKS.length} (gesamt ${saved.productComponents.length})`,
  );
  console.log(`  Händler:     ${DEALERS.length} (gesamt ${saved.dealers.length})`);
  console.log(
    `  Logistik:    ${LOGISTICS_BLOCKS.length} Bausteine, ${LOGISTICS_TEMPLATES.length} Vorlagen`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

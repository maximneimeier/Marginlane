import { describe, expect, it } from "vitest";
import {
  productIdsForSupplier,
  supplierIdsForProduct,
  unitPurchaseForProductSupplier,
} from "./productSuppliers";
import { EMPTY_DATA, type AppData } from "./types";

const data: AppData = {
  ...EMPTY_DATA,
  suppliers: [
    {
      id: "s1",
      name: "Alpha",
      country: "VN",
      contactName: "",
      email: "",
      phone: "",
      currency: "USD",
      paymentDays: 30,
      paymentUnit: "Tage",
      skontoPercent: 0,
      skontoDays: 0,
      incoterm: "FOB",
      taxId: "",
      legalForm: "",
      website: "",
      originPort: "",
      leadTimeDays: 30,
      iban: "",
      certifications: "",
      status: "active",
      notes: "",
      paymentTerms: "30 Tage",
      createdAt: "2026-01-01",
    },
    {
      id: "s2",
      name: "Beta",
      country: "CN",
      contactName: "",
      email: "",
      phone: "",
      currency: "USD",
      paymentDays: 30,
      paymentUnit: "Tage",
      skontoPercent: 0,
      skontoDays: 0,
      incoterm: "FOB",
      taxId: "",
      legalForm: "",
      website: "",
      originPort: "",
      leadTimeDays: 30,
      iban: "",
      certifications: "",
      status: "active",
      notes: "",
      paymentTerms: "30 Tage",
      createdAt: "2026-01-01",
    },
  ],
  catalogProducts: [
    {
      id: "p1",
      name: "Lounge",
      sku: "L1",
      listPrice: null,
      pricingUnit: "pcs",
      currency: "EUR",
      status: "active",
      category: "",
      targetMarginPercent: null,
      hsCode: "",
      countryOfOrigin: "",
      dutyRatePercent: 0,
      notes: "",
      documents: [],
      createdAt: "2026-01-01",
    },
  ],
  components: [
    {
      id: "c1",
      supplierId: "s1",
      name: "Frame",
      sku: "",
      currency: "USD",
      purchasePricePerUnit: 10,
      moq: 0,
      discountTiers: [],
      priceHistory: [],
      hsCode: "",
      countryOfOrigin: "",
      dutyRatePercent: 0,
      notes: "",
    },
  ],
  productComponents: [
    {
      id: "pc1",
      productId: "p1",
      componentId: "c1",
      quantityPerProductUnit: 1,
      purchasePriceOverride: null,
    },
  ],
  productSuppliers: [
    {
      id: "ps1",
      productId: "p1",
      supplierId: "s1",
      unitPurchasePrice: null,
      preferred: true,
      notes: "",
    },
    {
      id: "ps2",
      productId: "p1",
      supplierId: "s2",
      unitPurchasePrice: 42,
      preferred: false,
      notes: "Alternate source",
    },
  ],
};

describe("productSuppliers", () => {
  it("lists multiple suppliers for one product", () => {
    expect(supplierIdsForProduct(data, "p1").sort()).toEqual(["s1", "s2"]);
  });

  it("lists products for a supplier", () => {
    expect(productIdsForSupplier(data, "s2")).toEqual(["p1"]);
  });

  it("uses product-supplier purchase override", () => {
    expect(unitPurchaseForProductSupplier(data, "p1", "s2")).toBe(42);
    expect(unitPurchaseForProductSupplier(data, "p1", "s1")).toBe(10);
  });
});

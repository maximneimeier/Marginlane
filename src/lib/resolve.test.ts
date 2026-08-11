import { describe, expect, it } from "vitest";
import {
  resolveCommercial,
  resolveComponentCurrency,
  resolveSaleCostItems,
  resolveSalePrice,
  resolveUnitPurchasePrice,
  WORKSPACE_DEFAULT_CURRENCY,
} from "@/lib/resolve";
import type { Batch, Component, Dealer, Sale, Supplier } from "@/lib/types";

const supplier: Supplier = {
  id: "s1",
  name: "Acme",
  country: "CN",
  contactName: "Li",
  email: "li@acme.cn",
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
  leadTimeDays: 0,
  iban: "",
  certifications: "",
  status: "active",
  notes: "",
  paymentTerms: "30 Tage",
  createdAt: "2026-01-01",
};

describe("resolveCommercial", () => {
  it("inherits currency from supplier", () => {
    const resolved = resolveCommercial(supplier);
    expect(resolved.currency).toBe("USD");
    expect(resolved.sources.currency).toBe("supplier");
  });

  it("allows batch override", () => {
    const resolved = resolveCommercial(supplier, null, {
      currency: "EUR",
      paymentDays: null,
      paymentUnit: null,
      skontoPercent: null,
      skontoDays: null,
      incoterm: null,
    });
    expect(resolved.currency).toBe("EUR");
    expect(resolved.sources.currency).toBe("batch");
  });
});

describe("resolveComponentCurrency", () => {
  it("inherits from supplier when currency is null", () => {
    const c: Pick<Component, "supplierId" | "currency"> = {
      supplierId: "s1",
      currency: null,
    };
    const r = resolveComponentCurrency(c, supplier);
    expect(r.value).toBe("USD");
    expect(r.source).toBe("supplier");
  });

  it("uses explicit component currency", () => {
    const r = resolveComponentCurrency(
      { supplierId: "s1", currency: "CNY" },
      supplier,
    );
    expect(r.value).toBe("CNY");
    expect(r.source).toBe("component");
  });

  it("falls back to workspace default without supplier", () => {
    const r = resolveComponentCurrency(
      { supplierId: "", currency: null },
      undefined,
    );
    expect(r.value).toBe(WORKSPACE_DEFAULT_CURRENCY);
    expect(r.source).toBe("none");
  });
});

describe("resolveUnitPurchasePrice", () => {
  const components: Component[] = [
    {
      id: "c1",
      supplierId: "s1",
      name: "PCB",
      sku: "",
      currency: null,
      purchasePricePerUnit: 3,
      notes: "",
    },
  ];
  const productComponents = [
    {
      id: "pc1",
      productId: "p1",
      componentId: "c1",
      quantityPerProductUnit: 2,
      purchasePriceOverride: null,
    },
  ];

  it("sums BOM when batch has no override", () => {
    const batch = { unitPurchasePrice: null } as Batch;
    const r = resolveUnitPurchasePrice(
      "p1",
      components,
      productComponents,
      batch,
    );
    expect(r.value).toBe(6);
    expect(r.source).toBe("product");
  });

  it("uses batch override", () => {
    const batch = { unitPurchasePrice: 9.5 } as Batch;
    const r = resolveUnitPurchasePrice(
      "p1",
      components,
      productComponents,
      batch,
    );
    expect(r.value).toBe(9.5);
    expect(r.source).toBe("batch");
  });
});

describe("resolveSalePrice / resolveSaleCostItems", () => {
  const dealer: Dealer = {
    id: "d1",
    name: "Retail",
    country: "DE",
    contactName: "",
    email: "",
    phone: "",
    channel: "retail",
    paymentTerms: "",
    currency: "EUR",
    defaultSellPrice: 25,
    salesCostItems: [
      {
        id: "sc1",
        type: "Provision",
        label: "Provision",
        amount: 5,
        allocation: "percent_of_goods",
        phase: "vertrieb",
      },
    ],
    status: "active",
    notes: "",
    createdAt: "2026-01-01",
  };

  it("inherits sell price and costs from dealer", () => {
    const sale: Sale = {
      id: "sale1",
      dealerId: "d1",
      salePricePerUnit: null,
      quantity: 10,
      channel: "",
      costItems: null,
    };
    expect(resolveSalePrice(dealer, sale).value).toBe(25);
    expect(resolveSaleCostItems(dealer, sale).source).toBe("dealer");
    expect(resolveSaleCostItems(dealer, sale).value).toHaveLength(1);
  });

  it("uses sale overrides", () => {
    const sale: Sale = {
      id: "sale1",
      dealerId: "d1",
      salePricePerUnit: 30,
      quantity: 10,
      channel: "",
      costItems: [],
    };
    expect(resolveSalePrice(dealer, sale).source).toBe("batch");
    expect(resolveSaleCostItems(dealer, sale).value).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { AppData, Batch } from "@/lib/types";
import { EMPTY_DATA } from "@/lib/types";
import { buildMarginPackage } from "@/lib/marginPackage";

describe("buildMarginPackage", () => {
  it("includes DB1–DB3, partners and sale split", () => {
    const batch: Batch = {
      id: "b1",
      productId: "p1",
      supplierId: "s1",
      label: "Charge 1",
      quantity: 100,
      unitPurchasePrice: 5,
      currency: null,
      paymentDays: null,
      paymentUnit: null,
      skontoPercent: null,
      skontoDays: null,
      incoterm: null,
      costItems: [
        {
          id: "c1",
          type: "Fracht",
          label: "Fracht",
          amount: 100,
          allocation: "lump_sum",
          phase: "transport",
        },
      ],
      sales: [
        {
          id: "sale1",
          dealerId: "d1",
          channel: "B2B",
          quantity: 100,
          salePricePerUnit: null,
          costItems: null,
        },
      ],
      createdAt: "2026-01-01",
      orderDate: "2026-01-15",
      arrivalDate: null,
      expectedArrivalDate: null,
      poNumber: "",
      notes: "",
      receivedQuantity: null,
      soldDate: "2026-01-20",
      applySkonto: null,
      fxRateOverride: null,
      duty: {
        hsCode: "",
        countryOfOrigin: "",
        ratePercent: 0,
        fixedAmount: 0,
      },
      quotes: [],
      activeQuoteId: null,
    };

    const data: AppData = {
      ...EMPTY_DATA,
      companySettings: {
        ...EMPTY_DATA.companySettings,
        companyName: "Demo GmbH",
      },
      suppliers: [
        {
          id: "s1",
          name: "Supplier A",
          country: "CN",
          contactName: "",
          email: "",
          phone: "",
          currency: "EUR",
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
          paymentTerms: "",
          createdAt: "2026-01-01",
        },
      ],
      catalogProducts: [
        {
          id: "p1",
          name: "Widget",
          sku: "W-1",
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
      dealers: [
        {
          id: "d1",
          name: "Dealer B",
          country: "DE",
          contactName: "",
          email: "",
          phone: "",
          channel: "b2b",
          paymentTerms: "",
          currency: "EUR",
          defaultSellPrice: 20,
          salesCostItems: [
            {
              id: "sc1",
              type: "Provision",
              label: "Provision",
              amount: 10,
              allocation: "percent_of_goods",
              phase: "vertrieb",
            },
          ],
          status: "active",
          notes: "",
          createdAt: "2026-01-01",
        },
      ],
      batches: [batch],
    };

    const report = buildMarginPackage(data, batch);
    expect(report.companyName).toBe("Demo GmbH");
    expect(report.supplierName).toBe("Supplier A");
    expect(report.dealerNames).toContain("Dealer B");
    expect(report.revenue).toBe(2000);
    expect(report.db1).toBeGreaterThan(0);
    expect(report.db2).toBeLessThan(report.db1);
    expect(report.db3).toBeLessThan(report.db2);
    expect(report.sales).toBeGreaterThan(0);
    expect(report.salesLines).toHaveLength(1);
  });
});

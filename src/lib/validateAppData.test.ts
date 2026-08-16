import { describe, expect, it } from "vitest";
import { validateAppData } from "@/lib/validateAppData";
import { EMPTY_DATA, type AppData } from "@/lib/types";

function baseData(patch: Partial<AppData> = {}): AppData {
  return { ...EMPTY_DATA, ...patch };
}

describe("validateAppData", () => {
  it("accepts empty workspace", () => {
    expect(validateAppData(EMPTY_DATA)).toEqual([]);
  });

  it("rejects supplier missing required fields", () => {
    const issues = validateAppData(
      baseData({
        suppliers: [
          {
            id: "s1",
            name: "",
            country: "",
            contactName: "",
            email: "bad",
            phone: "",
            currency: "",
            paymentDays: 0,
            paymentUnit: "Tage",
            skontoPercent: 0,
            skontoDays: 0,
            incoterm: "",
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
      }),
    );
    expect(issues.some((i) => i.path.includes("name"))).toBe(true);
    expect(issues.some((i) => i.path.includes("email"))).toBe(true);
  });

  it("rejects duplicate product SKUs", () => {
    const issues = validateAppData(
      baseData({
        catalogProducts: [
          {
            id: "p1",
            name: "A",
            sku: "SKU-1",
            listPrice: null,
            pricingUnit: "pcs",
            currency: "EUR",
            status: "active",
            category: "",
            targetMarginPercent: null,
            notes: "",
            documents: [],
            createdAt: "2026-01-01",
          },
          {
            id: "p2",
            name: "B",
            sku: "sku-1",
            listPrice: null,
            pricingUnit: "pcs",
            currency: "EUR",
            status: "active",
            category: "",
            targetMarginPercent: null,
            notes: "",
            documents: [],
            createdAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(issues.some((i) => i.message.includes("Duplicate"))).toBe(true);
  });

  it("rejects negative batch quantity", () => {
    const issues = validateAppData(
      baseData({
        catalogProducts: [
          {
            id: "p1",
            name: "A",
            sku: "A1",
            listPrice: null,
            pricingUnit: "pcs",
            currency: "EUR",
            status: "active",
            category: "",
            targetMarginPercent: null,
            notes: "",
            documents: [],
            createdAt: "2026-01-01",
          },
        ],
        batches: [
          {
            id: "b1",
            productId: "p1",
            supplierId: "",
            label: "x",
            quantity: -5,
            unitPurchasePrice: 1,
            currency: null,
            paymentDays: null,
            paymentUnit: null,
            skontoPercent: null,
            skontoDays: null,
            incoterm: null,
            costItems: [],
            sales: [],
            orderDate: null,
            arrivalDate: null,
            soldDate: null,
            applySkonto: null,
            fxRateOverride: null,
            duty: { hsCode: "", countryOfOrigin: "", ratePercent: 0, fixedAmount: 0 },
            quotes: [],
            activeQuoteId: null,
            createdAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(issues.some((i) => i.path.includes("quantity"))).toBe(true);
  });
});

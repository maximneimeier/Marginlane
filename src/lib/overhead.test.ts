import { describe, expect, it } from "vitest";
import {
  allocateOverheadToProducts,
  amountForRange,
  isManualAllocationValid,
  monthlyEquivalent,
  sumManualPercents,
} from "@/lib/overhead";
import type { AppData, OverheadItem } from "@/lib/types";
import { EMPTY_DATA } from "@/lib/types";

function oh(partial: Partial<OverheadItem> & Pick<OverheadItem, "id" | "name">): OverheadItem {
  return {
    betrag: 1200,
    waehrung: "EUR",
    periode: "monatlich",
    kategorie: "verwaltungsgemeinkosten",
    kostenart: "fix",
    variableBasis: null,
    variableRate: null,
    verteilschluessel: "gleichmaessig",
    manuelleAufteilung: null,
    gueltigVon: null,
    gueltigBis: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    updatedBy: null,
    ...partial,
  };
}

describe("monthlyEquivalent / amountForRange", () => {
  it("converts yearly to monthly", () => {
    expect(monthlyEquivalent(oh({ id: "1", name: "Rent", periode: "jaehrlich", betrag: 1200 }))).toBe(
      100,
    );
  });

  it("sums fixed amount over months in range", () => {
    const item = oh({ id: "1", name: "Office", betrag: 100, periode: "monatlich" });
    expect(
      amountForRange(item, { from: "2026-01-01", to: "2026-03-31" }),
    ).toBe(300);
  });

  it("returns 0 outside validity", () => {
    const item = oh({
      id: "1",
      name: "Temp",
      betrag: 100,
      gueltigVon: "2026-06-01",
      gueltigBis: "2026-06-30",
    });
    expect(
      amountForRange(item, { from: "2026-01-01", to: "2026-03-31" }),
    ).toBe(0);
  });
});

describe("manual allocation", () => {
  it("validates percent sum ≈ 100", () => {
    expect(
      isManualAllocationValid([
        { percent: 40 },
        { percent: 60 },
      ]),
    ).toBe(true);
    expect(sumManualPercents([{ percent: 40 }, { percent: 50 }])).toBe(90);
    expect(isManualAllocationValid([{ percent: 40 }, { percent: 50 }])).toBe(
      false,
    );
  });
});

describe("allocateOverheadToProducts", () => {
  it("splits gleichmaessig across catalog products with activity", () => {
    const data: AppData = {
      ...EMPTY_DATA,
      catalogProducts: [
        {
          id: "p1",
          name: "A",
          sku: "A",
          listPrice: 10,
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
          sku: "B",
          listPrice: 10,
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
          label: "B1",
          quantity: 10,
          unitPurchasePrice: 5,
          currency: null,
          paymentDays: null,
          paymentUnit: null,
          skontoPercent: null,
          skontoDays: null,
          incoterm: null,
          costItems: [],
          sales: [
            {
              id: "sale1",
              dealerId: null,
              salePricePerUnit: 20,
              quantity: 10,
              channel: "",
              costItems: [],
            },
          ],
          orderDate: null,
          arrivalDate: null,
          soldDate: null,
          applySkonto: null,
          fxRateOverride: null,
          duty: { hsCode: "", countryOfOrigin: "", ratePercent: 0, fixedAmount: 0 },
          quotes: [],
          activeQuoteId: null,
          createdAt: "2026-02-01",
        },
        {
          id: "b2",
          productId: "p2",
          supplierId: "",
          label: "B2",
          quantity: 10,
          unitPurchasePrice: 5,
          currency: null,
          paymentDays: null,
          paymentUnit: null,
          skontoPercent: null,
          skontoDays: null,
          incoterm: null,
          costItems: [],
          sales: [
            {
              id: "sale2",
              dealerId: null,
              salePricePerUnit: 20,
              quantity: 10,
              channel: "",
              costItems: [],
            },
          ],
          orderDate: null,
          arrivalDate: null,
          soldDate: null,
          applySkonto: null,
          fxRateOverride: null,
          duty: { hsCode: "", countryOfOrigin: "", ratePercent: 0, fixedAmount: 0 },
          quotes: [],
          activeQuoteId: null,
          createdAt: "2026-02-01",
        },
      ],
      overheadItems: [
        oh({
          id: "oh1",
          name: "Office",
          betrag: 100,
          periode: "monatlich",
          verteilschluessel: "gleichmaessig",
        }),
      ],
    };

    const allocated = allocateOverheadToProducts(
      data.overheadItems,
      { from: "2026-02-01", to: "2026-02-28" },
      data,
    );
    // 100 for one month, split equally → 50 each
    expect(allocated.get("p1")).toBeCloseTo(50);
    expect(allocated.get("p2")).toBeCloseTo(50);
  });

  it("uses manual shares", () => {
    const data: AppData = {
      ...EMPTY_DATA,
      catalogProducts: [
        {
          id: "p1",
          name: "A",
          sku: "A",
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
          sku: "B",
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
          label: "B1",
          quantity: 5,
          unitPurchasePrice: 1,
          currency: null,
          paymentDays: null,
          paymentUnit: null,
          skontoPercent: null,
          skontoDays: null,
          incoterm: null,
          costItems: [],
          sales: [
            {
              id: "s1",
              dealerId: null,
              salePricePerUnit: 10,
              quantity: 5,
              channel: "",
              costItems: [],
            },
          ],
          orderDate: null,
          arrivalDate: null,
          soldDate: null,
          applySkonto: null,
          fxRateOverride: null,
          duty: { hsCode: "", countryOfOrigin: "", ratePercent: 0, fixedAmount: 0 },
          quotes: [],
          activeQuoteId: null,
          createdAt: "2026-02-15",
        },
        {
          id: "b2",
          productId: "p2",
          supplierId: "",
          label: "B2",
          quantity: 5,
          unitPurchasePrice: 1,
          currency: null,
          paymentDays: null,
          paymentUnit: null,
          skontoPercent: null,
          skontoDays: null,
          incoterm: null,
          costItems: [],
          sales: [
            {
              id: "s2",
              dealerId: null,
              salePricePerUnit: 10,
              quantity: 5,
              channel: "",
              costItems: [],
            },
          ],
          orderDate: null,
          arrivalDate: null,
          soldDate: null,
          applySkonto: null,
          fxRateOverride: null,
          duty: { hsCode: "", countryOfOrigin: "", ratePercent: 0, fixedAmount: 0 },
          quotes: [],
          activeQuoteId: null,
          createdAt: "2026-02-15",
        },
      ],
      overheadItems: [
        oh({
          id: "oh1",
          name: "Custom",
          betrag: 100,
          periode: "monatlich",
          verteilschluessel: "manuell",
          manuelleAufteilung: [
            { productId: "p1", percent: 80 },
            { productId: "p2", percent: 20 },
          ],
        }),
      ],
    };

    const allocated = allocateOverheadToProducts(
      data.overheadItems,
      { from: "2026-02-01", to: "2026-02-28" },
      data,
    );
    expect(allocated.get("p1")).toBeCloseTo(80);
    expect(allocated.get("p2")).toBeCloseTo(20);
  });
});

import { describe, expect, it } from "vitest";
import {
  normalizeCompanySettings,
  normalizeVatRates,
  resolveDefaultVatRateId,
  resolveVatRatePercent,
} from "@/lib/companySettings";
import { EMPTY_COMPANY_SETTINGS } from "@/lib/types";

describe("VAT rates", () => {
  it("seeds DE defaults when no rates exist", () => {
    const settings = normalizeCompanySettings({
      ...EMPTY_COMPANY_SETTINGS,
      vatRates: undefined as unknown as never,
      vatRatePercent: 19,
    });
    expect(settings.vatRates.length).toBeGreaterThanOrEqual(2);
    expect(settings.vatRates.some((r) => r.ratePercent === 19)).toBe(true);
    expect(settings.vatRates.some((r) => r.ratePercent === 7)).toBe(true);
    expect(settings.defaultVatRateId).toBeTruthy();
    expect(resolveVatRatePercent(settings)).toBe(19);
  });

  it("keeps custom rates and default selection", () => {
    const rates = normalizeVatRates(
      [
        { id: "a", name: "Standard", ratePercent: 19 },
        { id: "b", name: "Ermäßigt", ratePercent: 7 },
      ],
      19,
    );
    expect(resolveDefaultVatRateId(rates, "b")).toBe("b");
    expect(
      resolveVatRatePercent({
        vatRates: rates,
        defaultVatRateId: "b",
        vatRatePercent: 19,
      }),
    ).toBe(7);
  });

  it("falls back when default id is missing", () => {
    const rates = normalizeVatRates(
      [{ id: "only", name: "Only", ratePercent: 8.1 }],
      8.1,
    );
    expect(resolveDefaultVatRateId(rates, "gone")).toBe("only");
  });
});

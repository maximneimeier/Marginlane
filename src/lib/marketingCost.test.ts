import { describe, expect, it } from "vitest";
import { isMarketingCost } from "@/lib/overview";
import type { CostItem } from "@/lib/types";

function item(partial: Partial<CostItem> & Pick<CostItem, "type" | "label">): CostItem {
  return {
    id: "c1",
    amount: 10,
    allocation: "lump_sum",
    phase: "vertrieb",
    ...partial,
  };
}

describe("isMarketingCost", () => {
  it("treats Marketing / CAC type as marketing", () => {
    expect(
      isMarketingCost(item({ type: "Marketing / CAC", label: "Ads" })),
    ).toBe(true);
  });

  it("treats Provision as sales (not marketing)", () => {
    expect(
      isMarketingCost(item({ type: "Provision", label: "Händlerprovision" })),
    ).toBe(false);
  });

  it("detects marketing keywords in custom labels", () => {
    expect(
      isMarketingCost(item({ type: "Sonstiges", label: "CAC Facebook Ads" })),
    ).toBe(true);
  });
});

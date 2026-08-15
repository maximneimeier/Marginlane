import { describe, expect, it } from "vitest";
import {
  defaultCogsStructure,
  mergeCogsPlan,
  sumCogsForMonths,
} from "@/lib/cogsPlan";

describe("cogsPlan consolidated", () => {
  it("seeds default categories and lines", () => {
    const { categories, lineItems } = defaultCogsStructure();
    expect(categories.length).toBeGreaterThan(0);
    expect(lineItems.length).toBeGreaterThan(categories.length);
    expect(lineItems.every((l) => categories.some((c) => c.id === l.categoryId))).toBe(
      true,
    );
  });

  it("merges monthly amounts and sums by month", () => {
    const merged = mergeCogsPlan(
      [],
      [
        { lineItemId: "a", monthKey: "2025-01", amount: 100 },
        { lineItemId: "a", monthKey: "2025-02", amount: 50 },
        { lineItemId: "b", monthKey: "2025-01", amount: 20 },
      ],
    );
    expect(sumCogsForMonths(merged, ["2025-01", "2025-02"])).toEqual([
      120, 50,
    ]);
    expect(sumCogsForMonths(merged, ["2025-01"], ["a"])).toEqual([100]);
  });
});

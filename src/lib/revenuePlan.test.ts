import { describe, expect, it } from "vitest";
import {
  distributeAnnualVolume,
  mergeRevenuePlan,
  revenueAmount,
  sumRevenuePlan,
} from "@/lib/revenuePlan";

describe("revenuePlan", () => {
  it("merges product cells and drops empty ones", () => {
    const merged = mergeRevenuePlan(
      [
        {
          productId: "p1",
          monthKey: "2025-01",
          quantity: 10,
          unitPrice: 50,
        },
      ],
      [
        {
          productId: "p1",
          monthKey: "2025-02",
          quantity: 5,
          unitPrice: 40,
        },
        {
          productId: "p1",
          monthKey: "2025-01",
          quantity: 0,
          unitPrice: 0,
        },
      ],
    );
    expect(merged).toEqual([
      {
        productId: "p1",
        monthKey: "2025-02",
        quantity: 5,
        unitPrice: 40,
      },
    ]);
    expect(revenueAmount(merged[0]!)).toBe(200);
  });

  it("distributes annual volume across year months", () => {
    const months = ["2025-01", "2025-02", "2025-03", "2026-01"];
    const cells = distributeAnnualVolume("p1", "2025", 300, 10, months);
    expect(cells).toHaveLength(3);
    expect(sumRevenuePlan(cells)).toBe(3000);
    expect(cells.every((c) => c.unitPrice === 10)).toBe(true);
  });
});

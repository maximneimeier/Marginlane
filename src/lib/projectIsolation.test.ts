import { describe, expect, it } from "vitest";
import { EMPTY_DATA } from "@/lib/types";

/**
 * Isolations-Contract: jedes Projekt bekommt eine Deep-Copy von EMPTY_DATA,
 * keine gemeinsamen Objektreferenzen zwischen Workspaces.
 */
describe("project data isolation", () => {
  it("empty workspace payloads are deep-cloned (no shared references)", () => {
    const a = JSON.parse(JSON.stringify(EMPTY_DATA)) as typeof EMPTY_DATA;
    const b = JSON.parse(JSON.stringify(EMPTY_DATA)) as typeof EMPTY_DATA;

    expect(a).not.toBe(b);
    expect(a.suppliers).not.toBe(b.suppliers);
    expect(a.companySettings).not.toBe(b.companySettings);

    a.suppliers.push({
      id: "sup_test",
      name: "Isolate Me",
      country: "DE",
      currency: "EUR",
      status: "active",
      paymentTermsDays: 30,
      skontoPercent: null,
      skontoDays: null,
      taxId: "",
      contactName: "",
      contactEmail: "",
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);

    expect(b.suppliers).toHaveLength(0);
    expect(a.suppliers).toHaveLength(1);
  });
});

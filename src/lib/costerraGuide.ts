import type { AppData, Batch } from "./types";
import { getBatchContribution } from "./batchContribution";
import { batchOverheadShare } from "./batchContribution";
import { defaultOverviewRange } from "./overview";
import { calculateResolvedEconomics } from "./resolve";

export type CosterraGuideStepId =
  | "master"
  | "batch"
  | "material"
  | "logistics"
  | "sales"
  | "margins"
  | "personnel"
  | "afterOh";

export type CosterraGuideStep = {
  id: CosterraGuideStepId;
  done: boolean;
  href: string;
};

/** Fortschritt für den 5-Minuten-Costerra-Pfad. */
export function buildCosterraGuide(
  data: AppData,
  batch?: Batch | null,
): CosterraGuideStep[] {
  const hasMaster =
    data.suppliers.length > 0 &&
    data.catalogProducts.length > 0 &&
    data.dealers.length > 0;
  const hasBatch = data.batches.length > 0;
  const focus = batch ?? data.batches[0] ?? null;

  let material = false;
  let logistics = false;
  let sales = false;
  let margins = false;
  let afterOh = false;

  if (focus) {
    const econ = calculateResolvedEconomics(data, focus);
    const contrib = getBatchContribution(data, focus);
    material =
      econ.purchasePerUnit > 0 ||
      econ.procurementItems.some((i) => i.phase === "einkauf");
    logistics = econ.procurementItems.some(
      (i) => i.phase === "transport" || i.phase === "lager",
    );
    sales =
      econ.salesAggregate.rows.some(
        (r) => Boolean(r.sale.dealerId) || r.sellPrice > 0,
      ) &&
      (contrib.marketing > 0 || contrib.sales > 0 || econ.sellPrice > 0);
    margins = contrib.revenue > 0;
    const oh = batchOverheadShare(data, focus, defaultOverviewRange());
    afterOh = oh > 0 && margins;
  }

  const personnel = (data.personnelRoles ?? []).length > 0;
  const batchHref = focus ? `/batches/${focus.id}` : "/batches?new=1";
  const masterHref =
    data.suppliers.length === 0
      ? "/suppliers"
      : data.catalogProducts.length === 0
        ? "/products"
        : data.dealers.length === 0
          ? "/dealers"
          : "/suppliers";

  return [
    { id: "master", done: hasMaster, href: masterHref },
    { id: "batch", done: hasBatch, href: batchHref },
    { id: "material", done: material, href: batchHref },
    { id: "logistics", done: logistics, href: batchHref },
    { id: "sales", done: sales, href: batchHref },
    { id: "margins", done: margins, href: batchHref },
    {
      id: "personnel",
      done: personnel,
      href: "/overhead/personnel",
    },
    {
      id: "afterOh",
      done: afterOh,
      href: afterOh || !personnel ? batchHref : "/overhead/personnel",
    },
  ];
}

export function costerraGuideProgress(steps: CosterraGuideStep[]): {
  done: number;
  total: number;
} {
  return {
    done: steps.filter((s) => s.done).length,
    total: steps.length,
  };
}

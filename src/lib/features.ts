/**
 * Feature flags for Marginlane MVP (Phase 1) vs Phase 2.
 * Phase-2 code stays in the repo; flags only gate UI/routes.
 * Flip to `true` to re-enable later.
 */
export const FEATURES = {
  /**
   * Company-wide DB1–DB3 aggregation on Overview
   * (KPIs, contribution waterfall/sankey, product/supplier breakdown).
   */
  overviewConsolidation: false,

  /** Aggregated payment-timing cashflow chart on Overview. */
  overviewCashflow: false,

  /** Sales volume planning (/sales-volume) and overview strip. */
  salesVolumePlanning: false,

  /** Dedicated top-level /overhead page in nav (MVP: section inside Overview). */
  overheadTopLevelNav: false,

  /** Overhead Plan vs. Ist tab. */
  overheadPlanVsActual: false,

  /** Overhead charts tab (timeline, sankey, waterfall). */
  overheadCharts: false,

  /** Run-rate / YoY strip on overhead page. */
  overheadRunRate: false,

  /** CSV export of overhead period report. */
  overheadCsvExport: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag];
}

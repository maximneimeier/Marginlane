"use client";

import { useState } from "react";
import type { AppData, Batch } from "@/lib/types";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import {
  buildMarginPackage,
  buildMarginPackages,
} from "@/lib/marginPackage";
import {
  downloadMarginPackageExcel,
  downloadMarginPackagePdf,
  type MarginPackageLabels,
} from "@/lib/marginPackageExport";
import { Button } from "@/components/ui";

function labelsFromT(
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): MarginPackageLabels {
  return {
    title: t("marginPackage.title"),
    company: t("marginPackage.company"),
    generatedAt: t("marginPackage.generatedAt"),
    currency: t("marginPackage.currency"),
    batch: t("marginPackage.batch"),
    product: t("marginPackage.product"),
    sku: t("marginPackage.sku"),
    quantity: t("marginPackage.quantity"),
    unit: t("marginPackage.unit"),
    supplier: t("marginPackage.supplier"),
    country: t("marginPackage.country"),
    dealers: t("marginPackage.dealers"),
    quote: t("marginPackage.quote"),
    purchase: t("marginPackage.purchase"),
    landed: t("marginPackage.landed"),
    sell: t("marginPackage.sell"),
    revenue: t("marginPackage.revenue"),
    material: t("marginPackage.material"),
    logistics: t("marginPackage.logistics"),
    marketing: t("marginPackage.marketing"),
    salesCosts: t("marginPackage.salesCosts"),
    db1: t("marginPackage.db1"),
    db2: t("marginPackage.db2"),
    db3: t("marginPackage.db3"),
    perUnit: t("marginPackage.perUnit"),
    total: t("marginPackage.total"),
    marginPercent: t("marginPackage.marginPercent"),
    overhead: t("marginPackage.overhead"),
    afterOverhead: t("marginPackage.afterOverhead"),
    partners: t("marginPackage.partners"),
    sales: t("marginPackage.sales"),
    channel: t("marginPackage.channel"),
    waterfall: t("marginPackage.waterfall"),
    overview: t("marginPackage.overview"),
    portfolio: t("marginPackage.portfolio"),
    none: t("common.emDash"),
  };
}

type Props = {
  data: AppData;
  /** Wenn gesetzt: eine Charge. Sonst Portfolio aller Chargen. */
  batch?: Batch;
  variant?: "secondary" | "ghost";
};

export function MarginPackageExportButtons({
  data,
  batch,
  variant = "secondary",
}: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);

  async function run(kind: "pdf" | "xlsx") {
    setBusy(kind);
    try {
      const labels = labelsFromT(t);
      const reports = batch
        ? [buildMarginPackage(data, batch)]
        : buildMarginPackages(data);
      if (reports.length === 0) return;
      if (kind === "pdf") {
        await downloadMarginPackagePdf(reports, labels);
      } else {
        await downloadMarginPackageExcel(reports, labels);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={variant}
        disabled={busy !== null || (!batch && data.batches.length === 0)}
        onClick={() => void run("pdf")}
      >
        {busy === "pdf"
          ? t("marginPackage.exporting")
          : t("marginPackage.exportPdf")}
      </Button>
      <Button
        variant={variant}
        disabled={busy !== null || (!batch && data.batches.length === 0)}
        onClick={() => void run("xlsx")}
      >
        {busy === "xlsx"
          ? t("marginPackage.exporting")
          : t("marginPackage.exportExcel")}
      </Button>
    </div>
  );
}

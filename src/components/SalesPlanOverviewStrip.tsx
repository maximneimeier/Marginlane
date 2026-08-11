"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import type { DateRange } from "@/lib/overview";
import { summarizePlannedVolume } from "@/lib/salesPlan";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import { Card } from "@/components/ui";

type Props = {
  range: DateRange;
};

export function SalesPlanOverviewStrip({ range }: Props) {
  const { data } = useStore();
  const { t, locale } = useI18n();
  const scenario = data.salesPlanSettings?.activeScenario ?? "base";
  const summary = useMemo(
    () => summarizePlannedVolume(data, range, scenario),
    [data, range, scenario],
  );

  const delta = summary.actualQuantity - summary.quantity;

  return (
    <Card className="!p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
            {t("overviewPage.salesPlan.title")}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {t("overviewPage.salesPlan.hint", {
              scenario: t(
                `salesVolume.scenario.${scenario}` as MessageKey,
              ),
            })}
          </p>
        </div>
        <Link
          href="/sales-volume"
          className="text-[12px] font-medium text-accent hover:underline"
        >
          {t("overviewPage.salesPlan.link")}
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
        <Metric
          label={t("overviewPage.salesPlan.planQty")}
          value={
            summary.quantity > 0
              ? summary.quantity.toLocaleString(locale)
              : "—"
          }
        />
        <Metric
          label={t("overviewPage.salesPlan.planRevenue")}
          value={
            summary.revenue > 0
              ? formatEuro(summary.revenue, locale)
              : "—"
          }
        />
        <Metric
          label={t("overviewPage.salesPlan.actualQty")}
          value={
            summary.actualQuantity > 0
              ? summary.actualQuantity.toLocaleString(locale)
              : "—"
          }
        />
        <Metric
          label={t("overviewPage.salesPlan.delta")}
          value={
            summary.quantity === 0 && summary.actualQuantity === 0
              ? "—"
              : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toLocaleString(locale)}`
          }
          tone={
            delta > 0 ? "danger" : delta < 0 ? "success" : "muted"
          }
        />
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success" | "muted";
}) {
  const valueClass =
    tone === "danger"
      ? "text-danger"
      : tone === "success"
        ? "text-success"
        : tone === "muted"
          ? "text-muted"
          : "text-foreground";
  return (
    <div className="min-w-0">
      <span className="text-[12px] text-muted-soft">{label}</span>{" "}
      <span className={`font-medium tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

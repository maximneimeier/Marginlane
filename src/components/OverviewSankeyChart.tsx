"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import {
  buildContributionSankey,
  type BreakdownRow,
  type OverviewKpis,
  type SankeyMetricId,
} from "@/lib/overview";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] animate-pulse rounded-[10px] bg-surface-soft" />
  ),
});

const METRIC_COLORS: Record<SankeyMetricId, string> = {
  revenue: "#266df0",
  material: "#e5484d",
  logistics: "#e5484d",
  marketing: "#e5484d",
  sales: "#e5484d",
  db1: "#1c1d1f",
  db2: "#1c1d1f",
  db3: "#0fc27b",
};

const PRODUCT_PALETTE = [
  "#5b8def",
  "#7aa2f7",
  "#3d6fd8",
  "#8bb4ff",
  "#4a7ae0",
  "#6b9aef",
  "#9ec0ff",
  "#2f5fc4",
];

export function OverviewSankeyChart({
  kpis,
  products,
}: {
  kpis: OverviewKpis;
  products: BreakdownRow[];
}) {
  const { t, locale } = useI18n();

  const metricLabels = useMemo(
    (): Record<SankeyMetricId, string> => ({
      revenue: t("overviewPage.wf.revenue"),
      material: t("overviewPage.wf.material").replace(/^−\s*/, ""),
      logistics: t("overviewPage.wf.logistics").replace(/^−\s*/, ""),
      marketing: t("overviewPage.wf.marketing").replace(/^−\s*/, ""),
      sales: t("overviewPage.wf.sales").replace(/^−\s*/, ""),
      db1: t("overviewPage.wf.db1"),
      db2: t("overviewPage.wf.db2"),
      db3: t("overviewPage.wf.db3"),
    }),
    [t],
  );

  const { nodes, links } = useMemo(
    () => buildContributionSankey(kpis, products),
    [kpis, products],
  );

  const displayName = useMemo(() => {
    const map = new Map<string, string>();
    const used = new Set<string>();
    for (const n of nodes) {
      let name =
        n.kind === "product"
          ? (n.label ?? n.id)
          : metricLabels[n.metricId ?? "revenue"];
      // Ensure unique ECharts node names
      if (used.has(name)) {
        name = `${name} (${n.id.slice(-4)})`;
      }
      used.add(name);
      map.set(n.id, name);
    }
    return map;
  }, [nodes, metricLabels]);

  const option = useMemo<EChartsOption>(() => {
    let productColorIdx = 0;

    return {
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
        formatter: (params: unknown) => {
          const p = params as {
            dataType?: string;
            name?: string;
            data?: {
              source?: string;
              target?: string;
              value?: number;
              amount?: number;
            };
          };
          if (p.dataType === "edge" && p.data) {
            return `${p.data.source} → ${p.data.target}<br/><b>${formatEuro(p.data.value ?? 0, locale)}</b>`;
          }
          const amount = p.data?.amount;
          if (amount != null) {
            return `${p.name}<br/><b>${formatEuro(amount, locale)}</b>`;
          }
          return `${p.name ?? ""}`;
        },
      },
      series: [
        {
          type: "sankey",
          emphasis: { focus: "adjacency" },
          nodeAlign: "left",
          nodeGap: 14,
          nodeWidth: 16,
          layoutIterations: 0,
          data: nodes.map((n) => {
            const name = displayName.get(n.id) ?? n.id;
            const color =
              n.kind === "product"
                ? PRODUCT_PALETTE[productColorIdx++ % PRODUCT_PALETTE.length]
                : n.metricId === "db3" && kpis.db3 < 0
                  ? "#e5484d"
                  : METRIC_COLORS[n.metricId ?? "revenue"];

            return {
              name,
              depth: n.depth,
              amount: n.value,
              itemStyle: {
                color,
                borderWidth: 0,
              },
              label: {
                formatter: `{b}\n${formatEuro(n.value, locale)}`,
                fontSize: 10,
                lineHeight: 14,
                color: "#1c1d1f",
              },
            };
          }),
          links: links.map((l) => ({
            source: displayName.get(l.source) ?? l.source,
            target: displayName.get(l.target) ?? l.target,
            value: l.value,
          })),
          lineStyle: {
            color: "gradient",
            curveness: 0.5,
            opacity: 0.4,
          },
          label: {
            fontFamily: "inherit",
          },
        },
      ],
    };
  }, [nodes, links, displayName, locale, kpis.db3]);

  const height = Math.max(
    380,
    280 + nodes.filter((n) => n.kind === "product").length * 28,
  );

  if (links.length === 0) {
    return (
      <p className="mt-4 text-[13px] text-muted">{t("overviewPage.empty")}</p>
    );
  }

  return (
    <div className="mt-2 w-full min-w-0">
      <ReactECharts
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge
      />
    </div>
  );
}

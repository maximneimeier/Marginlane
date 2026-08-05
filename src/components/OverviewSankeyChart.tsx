"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import {
  buildContributionSankey,
  verifyContributionIdentity,
  type OverviewKpis,
  type SankeyNodeId,
} from "@/lib/overview";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] animate-pulse rounded-[10px] bg-surface-soft" />
  ),
});

const NODE_COLORS: Record<SankeyNodeId, string> = {
  revenue: "#266df0",
  material: "#e5484d",
  logistics: "#e5484d",
  marketing: "#e5484d",
  sales: "#e5484d",
  db1: "#1c1d1f",
  db2: "#1c1d1f",
  db3: "#0fc27b",
};

export function OverviewSankeyChart({ kpis }: { kpis: OverviewKpis }) {
  const { t, locale } = useI18n();

  const labelMap = useMemo(
    (): Record<SankeyNodeId, string> => ({
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
    () => buildContributionSankey(kpis),
    [kpis],
  );
  const identity = useMemo(() => verifyContributionIdentity(kpis), [kpis]);

  const option = useMemo<EChartsOption>(() => {
    const label = (id: SankeyNodeId) => labelMap[id];

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
          nodeGap: 18,
          nodeWidth: 18,
          layoutIterations: 0,
          data: nodes.map((n) => ({
            name: label(n.id),
            depth: n.depth,
            amount: n.value,
            itemStyle: {
              color:
                n.id === "db3" && kpis.db3 < 0
                  ? "#e5484d"
                  : NODE_COLORS[n.id],
              borderWidth: 0,
            },
            label: {
              formatter: `{b}\n${formatEuro(n.value, locale)}`,
              fontSize: 10,
              lineHeight: 14,
              color: "#1c1d1f",
            },
          })),
          links: links.map((l) => ({
            source: label(l.source),
            target: label(l.target),
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
  }, [nodes, links, labelMap, locale, kpis.db3]);

  if (links.length === 0) {
    return (
      <p className="mt-4 text-[13px] text-muted">{t("overviewPage.empty")}</p>
    );
  }

  return (
    <div className="mt-2 w-full min-w-0 space-y-4">
      <ReactECharts
        option={option}
        style={{ height: 380, width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge
      />

      <div className="grid gap-2 rounded-[10px] border border-line bg-surface-faint px-3 py-2.5 sm:grid-cols-3">
        <IdentityCheck
          ok={identity.stage1}
          title={t("overviewPage.sankey.stage1")}
          detail={`${formatEuro(kpis.revenue, locale)} = ${formatEuro(kpis.material, locale)} + ${formatEuro(kpis.db1, locale)}`}
        />
        <IdentityCheck
          ok={identity.stage2}
          title={t("overviewPage.sankey.stage2")}
          detail={`${formatEuro(kpis.db1, locale)} = ${formatEuro(kpis.logistics, locale)} + ${formatEuro(kpis.db2, locale)}`}
        />
        <IdentityCheck
          ok={identity.stage3}
          title={t("overviewPage.sankey.stage3")}
          detail={`${formatEuro(kpis.db2, locale)} = ${formatEuro(kpis.marketing, locale)} + ${formatEuro(kpis.sales, locale)} + ${formatEuro(kpis.db3, locale)}`}
        />
      </div>
    </div>
  );
}

function IdentityCheck({
  ok,
  title,
  detail,
}: {
  ok: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
        <span
          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
            ok ? "bg-success" : "bg-danger"
          }`}
          aria-hidden
        />
        {title}
        <span className={`text-[11px] ${ok ? "text-success" : "text-danger"}`}>
          {ok ? "✓" : "✗"}
        </span>
      </p>
      <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted" title={detail}>
        {detail}
      </p>
    </div>
  );
}

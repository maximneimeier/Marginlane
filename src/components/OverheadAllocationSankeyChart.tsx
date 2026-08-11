"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import type { AppData } from "@/lib/types";
import type { DateRange } from "@/lib/overview";
import {
  buildOverheadSankey,
  type OverheadSankeyGroupBy,
} from "@/lib/overhead";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import { Card, Field, Select } from "@/components/ui";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] animate-pulse rounded-[10px] bg-surface-soft" />
  ),
});

const OVERHEAD_PALETTE = [
  "#e5484d",
  "#f5a524",
  "#d97706",
  "#ea580c",
  "#b45309",
  "#c2410c",
];

const PRODUCT_PALETTE = [
  "#266df0",
  "#5b8def",
  "#3d6fd8",
  "#7aa2f7",
  "#4a7ae0",
  "#6b9aef",
  "#2f5fc4",
  "#8bb4ff",
];

type Props = {
  data: AppData;
  range: DateRange;
};

export function OverheadAllocationSankeyChart({ data, range }: Props) {
  const { t, locale } = useI18n();
  const [groupBy, setGroupBy] = useState<OverheadSankeyGroupBy>("position");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const { nodes, links } = useMemo(
    () =>
      buildOverheadSankey(data, range, groupBy, (kategorie) =>
        t(`overhead.category.${kategorie}` as MessageKey),
      ),
    [data, range, groupBy, t],
  );

  const displayName = useMemo(() => {
    const map = new Map<string, string>();
    const used = new Set<string>();
    for (const n of nodes) {
      let name = n.label;
      if (used.has(name)) {
        name = `${name} (${n.id.slice(-4)})`;
      }
      used.add(name);
      map.set(n.id, name);
    }
    return map;
  }, [nodes]);

  const chartKey = useMemo(
    () =>
      [
        groupBy,
        range.from,
        range.to,
        ...nodes.map((n) => `${n.id}:${n.amount}`),
        ...links.map((l) => `${l.source}>${l.target}:${l.value}`),
      ].join("|"),
    [groupBy, range.from, range.to, nodes, links],
  );

  const option = useMemo<EChartsOption>(() => {
    let overheadIdx = 0;
    let productIdx = 0;

    return {
      animation: false,
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
          nodeAlign: "justify",
          nodeGap: 14,
          nodeWidth: 16,
          layoutIterations: 32,
          data: nodes.map((n) => {
            const name = displayName.get(n.id) ?? n.id;
            const color =
              n.kind === "overhead"
                ? OVERHEAD_PALETTE[overheadIdx++ % OVERHEAD_PALETTE.length]
                : PRODUCT_PALETTE[productIdx++ % PRODUCT_PALETTE.length];

            return {
              name,
              depth: n.depth,
              amount: n.amount,
              itemStyle: {
                color,
                borderWidth: 0,
              },
              label: {
                formatter: `{b}\n${formatEuro(n.amount, locale)}`,
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
            opacity: 0.45,
          },
          label: {
            fontFamily: "inherit",
          },
        },
      ],
    };
  }, [nodes, links, displayName, locale]);

  const height = Math.max(
    320,
    220 +
      Math.max(
        nodes.filter((n) => n.kind === "overhead").length,
        nodes.filter((n) => n.kind === "product").length,
      ) *
        36,
  );

  return (
    <Card className="!p-4 sm:!p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
            {t("overhead.chart.sankey.title")}
          </h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {t("overhead.chart.sankey.description")}
          </p>
        </div>
        <Field label={t("overhead.chart.sankey.groupBy")}>
          <Select
            value={groupBy}
            onChange={(e) =>
              setGroupBy(e.target.value as OverheadSankeyGroupBy)
            }
            className="!w-[220px]"
          >
            <option value="position">
              {t("overhead.chart.sankey.groupBy.position")}
            </option>
            <option value="category">
              {t("overhead.chart.sankey.groupBy.category")}
            </option>
          </Select>
        </Field>
      </div>
      {links.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center rounded-[10px] border border-dashed border-line bg-surface-faint text-[13px] text-muted">
          {t("overhead.chart.sankey.empty")}
        </div>
      ) : (
        <div className="relative w-full min-w-0 overflow-hidden">
          {mounted ? (
            <ReactECharts
              key={chartKey}
              option={option}
              style={{ height, width: "100%" }}
              opts={{ renderer: "svg" }}
              notMerge
              lazyUpdate
            />
          ) : (
            <div className="h-[360px] animate-pulse rounded-[10px] bg-surface-soft" />
          )}
        </div>
      )}
    </Card>
  );
}

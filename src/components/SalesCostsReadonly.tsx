"use client";

import type { CostItem } from "@/lib/types";
import { useI18n } from "@/hooks/useI18n";
import { formatEuro } from "@/lib/format";

type Props = {
  items: CostItem[];
  emptyHint?: string;
  unitLabel?: string;
};

export function SalesCostsReadonly({ items, emptyHint, unitLabel }: Props) {
  const { t, allocationLabel, locale } = useI18n();

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-foreground">
        {t("salesCosts.title")}
      </h3>
      {items.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-line bg-surface-faint px-3 py-4 text-[13px] text-muted">
          {emptyHint ?? t("salesCosts.emptyHint")}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[8px] border border-line bg-surface-faint">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2.5 text-[13px] last:border-b-0"
            >
              <span>
                <span className="font-medium text-foreground">
                  {item.label || item.type}
                </span>
                <span className="ml-2 text-[12px] text-muted-soft">
                  {allocationLabel(item.allocation, true, unitLabel)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {item.allocation === "percent_of_goods"
                  ? `${item.amount} %`
                  : formatEuro(item.amount, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-muted-soft">
        {t("salesCosts.readonlyHint")}
      </p>
    </div>
  );
}

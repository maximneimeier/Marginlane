"use client";

import type { CostItem } from "@/lib/types";
import { ALLOCATION_LABELS } from "@/lib/types";
import { formatEuro } from "@/lib/format";

type Props = {
  items: CostItem[];
  emptyHint?: string;
};

export function SalesCostsReadonly({
  items,
  emptyHint = "Händler wählen, um Vertriebskosten zu sehen.",
}: Props) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-foreground">
        Vertriebskosten
      </h3>
      {items.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-line bg-surface-faint px-3 py-4 text-[13px] text-muted">
          {emptyHint}
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
                  {ALLOCATION_LABELS[item.allocation]}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {item.allocation === "percent_of_goods"
                  ? `${item.amount} %`
                  : formatEuro(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-muted-soft">
        Nur beim Händler bearbeitbar.
      </p>
    </div>
  );
}

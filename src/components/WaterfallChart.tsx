"use client";

import type { WaterfallStep } from "@/lib/calc";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";

export function WaterfallChart({
  steps,
  unitLabel,
}: {
  steps: WaterfallStep[];
  unitLabel?: string;
}) {
  const { waterfallLabel, locale } = useI18n();
  const max = Math.max(
    ...steps.map((s) => Math.abs(s.amountPerUnit)),
    ...steps.map((s) => Math.abs(s.runningTotal)),
    1,
  );

  return (
    <div className="space-y-2.5">
      {steps.map((step) => {
        const width = Math.min(100, (Math.abs(step.amountPerUnit) / max) * 100);
        const isMargin = step.kind === "margin";
        const isSubtotal = step.kind === "subtotal" || step.kind === "revenue";
        const positive = step.amountPerUnit >= 0;

        return (
          <div key={step.id}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span
                className={
                  isSubtotal || isMargin
                    ? "font-medium text-foreground"
                    : "text-muted"
                }
              >
                {waterfallLabel(step.id, step.label, unitLabel)}
              </span>
              <span
                className={`tabular-nums ${
                  isMargin
                    ? positive
                      ? "font-medium text-success"
                      : "font-medium text-danger"
                    : "text-foreground"
                }`}
              >
                {step.kind === "cost" ? "+" : ""}
                {formatEuro(step.amountPerUnit, locale)}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-soft">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isMargin
                    ? positive
                      ? "bg-success"
                      : "bg-danger"
                    : isSubtotal
                      ? "bg-foreground"
                      : step.kind === "revenue"
                        ? "bg-accent"
                        : "bg-accent/35"
                }`}
                style={{ width: `${Math.max(width, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

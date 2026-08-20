"use client";

import type { WaterfallStep } from "@/lib/calc";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";

export function WaterfallChart({
  steps,
  unitLabel,
  quantity,
}: {
  steps: WaterfallStep[];
  unitLabel?: string;
  /** Wenn gesetzt: zusätzlich Gesamtbetrag der Charge anzeigen */
  quantity?: number;
}) {
  const { waterfallLabel, locale, t } = useI18n();
  const showTotals = quantity != null && quantity > 0;
  const max = Math.max(
    ...steps.map((s) => Math.abs(s.amountPerUnit)),
    ...steps.map((s) => Math.abs(s.runningTotal)),
    1,
  );

  return (
    <div className="space-y-2.5">
      {showTotals ? (
        <div className="mb-1 flex justify-end gap-4 text-[11px] text-muted">
          <span className="w-[4.75rem] text-right">
            {t("batchNew.perUnitShort")}
          </span>
          <span className="w-[5.25rem] text-right">
            {t("batchNew.batchTotalShort")}
          </span>
        </div>
      ) : null}
      {steps.map((step) => {
        const width = Math.min(100, (Math.abs(step.amountPerUnit) / max) * 100);
        const isMargin = step.kind === "margin";
        const isSubtotal = step.kind === "subtotal" || step.kind === "revenue";
        const positive = step.amountPerUnit >= 0;
        const prefix =
          step.kind === "cost" && !step.id.startsWith("wf_") ? "+" : "";

        return (
          <div key={step.id}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span
                className={
                  isSubtotal || isMargin
                    ? "min-w-0 flex-1 font-medium text-foreground"
                    : "min-w-0 flex-1 text-muted"
                }
              >
                {waterfallLabel(step.id, step.label, unitLabel)}
              </span>
              <div className="flex shrink-0 items-baseline gap-4">
                <span
                  className={`w-[4.75rem] text-right tabular-nums ${
                    isMargin
                      ? positive
                        ? "font-medium text-success"
                        : "font-medium text-danger"
                      : "text-foreground"
                  }`}
                >
                  {prefix}
                  {formatEuro(step.amountPerUnit, locale)}
                </span>
                {showTotals ? (
                  <span
                    className={`w-[5.25rem] text-right tabular-nums ${
                      isSubtotal || isMargin
                        ? "font-medium text-foreground"
                        : "text-muted"
                    }`}
                  >
                    {prefix}
                    {formatEuro(step.amountPerUnit * quantity, locale)}
                  </span>
                ) : null}
              </div>
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

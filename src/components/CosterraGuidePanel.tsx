"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import {
  buildCosterraGuide,
  costerraGuideProgress,
  type CosterraGuideStepId,
} from "@/lib/costerraGuide";
import type { AppData, Batch } from "@/lib/types";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import { Card } from "@/components/ui";

const STEP_KEYS: Record<CosterraGuideStepId, MessageKey> = {
  master: "costerraGuide.step.master",
  batch: "costerraGuide.step.batch",
  material: "costerraGuide.step.material",
  logistics: "costerraGuide.step.logistics",
  sales: "costerraGuide.step.sales",
  margins: "costerraGuide.step.margins",
  personnel: "costerraGuide.step.personnel",
  afterOh: "costerraGuide.step.afterOh",
};

export function CosterraGuidePanel({
  data,
  batch,
  compact = false,
}: {
  data: AppData;
  batch?: Batch | null;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const steps = buildCosterraGuide(data, batch);
  const { done, total } = costerraGuideProgress(steps);
  const next = steps.find((s) => !s.done);

  if (done === total && compact) return null;

  return (
    <Card className={compact ? "!p-4 mb-4" : "!p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">
            {t("costerraGuide.title")}
          </h2>
          <p className="mt-1 text-[12px] text-muted">
            {t("costerraGuide.description", { done, total })}
          </p>
        </div>
        {next ? (
          <Link
            href={next.href}
            className="shrink-0 text-[13px] font-medium text-accent hover:underline"
          >
            {t("costerraGuide.next")}: {t(STEP_KEYS[next.id])}
          </Link>
        ) : (
          <span className="text-[13px] font-medium text-success">
            {t("costerraGuide.complete")}
          </span>
        )}
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={`flex items-start gap-2 rounded-[8px] border px-3 py-2 text-left transition-colors ${
                step.done
                  ? "border-line bg-surface-faint text-muted"
                  : next?.id === step.id
                    ? "border-accent/40 bg-accent-soft/40 text-foreground"
                    : "border-line bg-white text-foreground hover:bg-surface-faint"
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {step.done ? (
                  <Check size={14} className="text-success" aria-hidden />
                ) : (
                  <Circle size={14} className="text-muted-soft" aria-hidden />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium">
                  {index + 1}. {t(STEP_KEYS[step.id])}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

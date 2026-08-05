"use client";

import { useCallback, useMemo } from "react";
import { usePrefs, type AppLanguage } from "@/context/PreferencesContext";
import type {
  CostAllocation,
  CostPhase,
  DealerChannel,
  DealerStatus,
  PricingUnit,
  SupplierStatus,
} from "@/lib/types";
import { COST_TYPE_PRESETS, PRICING_UNITS } from "@/lib/types";
import type { OptionalColumn } from "@/lib/supplierRows";
import {
  localeTag,
  translate,
  type MessageKey,
} from "@/lib/i18n";

const COST_TYPE_KEYS = Object.fromEntries(
  COST_TYPE_PRESETS.map((preset) => [
    preset,
    `costType.${preset}` as MessageKey,
  ]),
) as Record<string, MessageKey>;

export function useI18n() {
  const { prefs, ready } = usePrefs();
  const lang: AppLanguage = prefs.language;
  const locale = localeTag(lang);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(lang, key, vars),
    [lang],
  );

  const plural = useCallback(
    (
      count: number,
      singular: MessageKey,
      pluralKey: MessageKey,
      vars?: Record<string, string | number>,
    ) =>
      translate(lang, count === 1 ? singular : pluralKey, {
        count,
        ...vars,
      }),
    [lang],
  );

  const costTypeLabel = useCallback(
    (type: string) => {
      const key = COST_TYPE_KEYS[type];
      return key ? translate(lang, key) : type;
    },
    [lang],
  );

  const phaseLabel = useCallback(
    (phase: CostPhase) => translate(lang, `phase.${phase}` as MessageKey),
    [lang],
  );

  const allocationLabel = useCallback(
    (
      allocation: CostAllocation,
      percentOfRevenueOrUnit: boolean | string = false,
      unit?: string,
    ) => {
      // Back-compat: (allocation, percentOfRevenue) oder (allocation, false, unit)
      const percentOfRevenue =
        typeof percentOfRevenueOrUnit === "boolean"
          ? percentOfRevenueOrUnit
          : false;
      const unitLabel =
        typeof percentOfRevenueOrUnit === "string"
          ? percentOfRevenueOrUnit
          : unit;

      if (allocation === "percent_of_goods" && percentOfRevenue) {
        return translate(lang, "allocation.percent_of_revenue");
      }
      if (allocation === "per_unit" && unitLabel) {
        return translate(lang, "allocation.per_unit_named", { unit: unitLabel });
      }
      return translate(lang, `allocation.${allocation}` as MessageKey);
    },
    [lang],
  );

  const pricingUnitLabel = useCallback(
    (unit: PricingUnit, long = false) =>
      translate(
        lang,
        (long ? `unit.${unit}.long` : `unit.${unit}`) as MessageKey,
      ),
    [lang],
  );

  const pricingUnits = PRICING_UNITS;

  const supplierStatusLabel = useCallback(
    (status: SupplierStatus) =>
      translate(lang, `supplier.status.${status}` as MessageKey),
    [lang],
  );

  const dealerStatusLabel = useCallback(
    (status: DealerStatus) =>
      translate(lang, `dealer.status.${status}` as MessageKey),
    [lang],
  );

  const dealerChannelLabel = useCallback(
    (channel: DealerChannel) =>
      translate(lang, `dealer.channel.${channel}` as MessageKey),
    [lang],
  );

  const optionalColLabel = useCallback(
    (col: OptionalColumn) =>
      translate(lang, `optionalCol.${col}` as MessageKey),
    [lang],
  );

  const countryLabel = useCallback(
    (code: string) => {
      if (!code) return translate(lang, "common.emDash");
      try {
        return (
          new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
        );
      } catch {
        return code;
      }
    },
    [lang, locale],
  );

  const waterfallLabel = useCallback(
    (stepId: string, fallback: string, unit?: string) => {
      if (stepId === "purchase") return translate(lang, "waterfall.purchase");
      if (stepId === "landed") return translate(lang, "waterfall.landed");
      if (stepId === "revenue") return translate(lang, "waterfall.revenue");
      if (stepId === "margin") {
        return translate(lang, "waterfall.margin", {
          unit: unit || translate(lang, "unit.pcs"),
        });
      }
      return costTypeLabel(fallback) !== fallback
        ? costTypeLabel(fallback)
        : fallback;
    },
    [lang, costTypeLabel],
  );

  return useMemo(
    () => ({
      t,
      plural,
      lang,
      locale,
      ready,
      costTypeLabel,
      phaseLabel,
      allocationLabel,
      pricingUnitLabel,
      pricingUnits,
      supplierStatusLabel,
      dealerStatusLabel,
      dealerChannelLabel,
      optionalColLabel,
      countryLabel,
      waterfallLabel,
    }),
    [
      t,
      plural,
      lang,
      locale,
      ready,
      costTypeLabel,
      phaseLabel,
      allocationLabel,
      pricingUnitLabel,
      pricingUnits,
      supplierStatusLabel,
      dealerStatusLabel,
      dealerChannelLabel,
      optionalColLabel,
      countryLabel,
      waterfallLabel,
    ],
  );
}

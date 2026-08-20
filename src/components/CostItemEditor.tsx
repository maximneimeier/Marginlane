"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { CostAllocation, CostItem, CostPhase } from "@/lib/types";
import { COST_TYPE_PRESETS } from "@/lib/types";
import { createId } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { Button, Field, Select, TextInput } from "./ui";

type Props = {
  items: CostItem[];
  onChange: (items: CostItem[]) => void;
  allowedPhases: CostPhase[];
  title: string;
  /** Wenn true: % bezieht sich auf Verkaufserlös statt Einkaufswarenwert */
  percentOfRevenue?: boolean;
  /** Kurzlabel der Preisenheit (Stk., g, …) für „pro {unit}“ */
  unitLabel?: string;
  /** Vertrieb: Provision/Marketing zuerst + Schnell-Buttons */
  salesMode?: boolean;
};

const SALES_PREFERRED = ["Provision", "Marketing / CAC"] as const;

export function CostItemEditor({
  items,
  onChange,
  allowedPhases,
  title,
  percentOfRevenue = false,
  unitLabel,
  salesMode = false,
}: Props) {
  const { t, costTypeLabel, phaseLabel, allocationLabel } = useI18n();

  const typeOptions = salesMode
    ? [
        ...SALES_PREFERRED,
        ...COST_TYPE_PRESETS.filter(
          (p) => !(SALES_PREFERRED as readonly string[]).includes(p),
        ),
      ]
    : [...COST_TYPE_PRESETS];

  function addItem(presetType?: string) {
    const phase = allowedPhases[0] ?? "einkauf";
    const type =
      presetType ??
      (salesMode ? SALES_PREFERRED[0] : COST_TYPE_PRESETS[0]);
    onChange([
      ...items,
      {
        id: createId("cost"),
        type,
        label: costTypeLabel(type),
        amount: 0,
        allocation: salesMode ? "percent_of_goods" : "lump_sum",
        phase,
      },
    ]);
  }

  function update(id: string, patch: Partial<CostItem>) {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.type && !patch.label) {
          next.label = costTypeLabel(patch.type);
        }
        return next;
      }),
    );
  }

  function remove(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function move(id: string, direction: -1 | 1) {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    onChange(next);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <div className="flex flex-wrap gap-1.5">
          {salesMode ? (
            <>
              <Button
                variant="secondary"
                className="h-7 px-2 text-[12px]"
                onClick={() => addItem("Provision")}
              >
                + {costTypeLabel("Provision")}
              </Button>
              <Button
                variant="secondary"
                className="h-7 px-2 text-[12px]"
                onClick={() => addItem("Marketing / CAC")}
              >
                + {costTypeLabel("Marketing / CAC")}
              </Button>
            </>
          ) : null}
          <Button variant="ghost" onClick={() => addItem()}>
            {t("costEditor.add")}
          </Button>
        </div>
      </div>

      {salesMode ? (
        <p className="mb-3 text-[12px] text-muted">{t("costEditor.salesHint")}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          {salesMode ? t("costEditor.emptySales") : t("costEditor.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="grid gap-3 rounded-md border border-line bg-white p-3 sm:grid-cols-12"
            >
              <div className="flex items-start sm:col-span-1">
                <div className="flex flex-col gap-0.5 pt-5">
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-muted hover:bg-surface-soft hover:text-foreground disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => move(item.id, -1)}
                    aria-label={t("costEditor.moveUp")}
                    title={t("costEditor.moveUp")}
                  >
                    <ChevronUp size={14} strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-muted hover:bg-surface-soft hover:text-foreground disabled:opacity-30"
                    disabled={index === items.length - 1}
                    onClick={() => move(item.id, 1)}
                    aria-label={t("costEditor.moveDown")}
                    title={t("costEditor.moveDown")}
                  >
                    <ChevronDown size={14} strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="sm:col-span-3">
                <Field label={t("costEditor.type")}>
                  <Select
                    value={item.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      update(item.id, {
                        type,
                        label: costTypeLabel(type),
                      });
                    }}
                  >
                    {typeOptions.map((preset) => (
                      <option key={preset} value={preset}>
                        {costTypeLabel(preset)}
                      </option>
                    ))}
                    {!typeOptions.includes(
                      item.type as (typeof COST_TYPE_PRESETS)[number],
                    ) ? (
                      <option value={item.type}>
                        {costTypeLabel(item.type)}
                      </option>
                    ) : null}
                  </Select>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t("costEditor.label")}>
                  <TextInput
                    value={item.label}
                    onChange={(e) => update(item.id, { label: e.target.value })}
                    placeholder={t("costEditor.labelPlaceholder")}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t("costEditor.amount")}>
                  <TextInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.amount || ""}
                    onChange={(e) =>
                      update(item.id, { amount: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t("costEditor.allocation")}>
                  <Select
                    value={item.allocation}
                    onChange={(e) =>
                      update(item.id, {
                        allocation: e.target.value as CostAllocation,
                      })
                    }
                  >
                    {(
                      [
                        "per_unit",
                        "lump_sum",
                        "percent_of_goods",
                      ] as CostAllocation[]
                    ).map((key) => (
                      <option key={key} value={key}>
                        {allocationLabel(key, percentOfRevenue, unitLabel)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t("costEditor.phase")}>
                  <div className="flex gap-2">
                    <Select
                      value={item.phase}
                      onChange={(e) =>
                        update(item.id, {
                          phase: e.target.value as CostPhase,
                        })
                      }
                      className="flex-1"
                    >
                      {allowedPhases.map((phase) => (
                        <option key={phase} value={phase}>
                          {phaseLabel(phase)}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="danger"
                      className="shrink-0 px-2"
                      onClick={() => remove(item.id)}
                      aria-label={t("costEditor.remove")}
                    >
                      ×
                    </Button>
                  </div>
                </Field>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

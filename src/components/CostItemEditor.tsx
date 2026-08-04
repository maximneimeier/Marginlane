"use client";

import type { CostAllocation, CostItem, CostPhase } from "@/lib/types";
import {
  ALLOCATION_LABELS,
  COST_TYPE_PRESETS,
  PHASE_LABELS,
} from "@/lib/types";
import { createId } from "@/lib/format";
import { Button, Field, Select, TextInput } from "./ui";

type Props = {
  items: CostItem[];
  onChange: (items: CostItem[]) => void;
  allowedPhases: CostPhase[];
  title: string;
  /** Wenn true: % bezieht sich auf Verkaufserlös statt Einkaufswarenwert */
  percentOfRevenue?: boolean;
};

export function CostItemEditor({
  items,
  onChange,
  allowedPhases,
  title,
  percentOfRevenue = false,
}: Props) {
  function addItem() {
    const phase = allowedPhases[0] ?? "einkauf";
    onChange([
      ...items,
      {
        id: createId("cost"),
        type: COST_TYPE_PRESETS[0],
        label: COST_TYPE_PRESETS[0],
        amount: 0,
        allocation: "lump_sum",
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
          next.label = patch.type;
        }
        return next;
      }),
    );
  }

  function remove(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <Button variant="ghost" onClick={addItem}>
          + Kostenposten
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Noch keine Kostenposten. Typen sind frei erweiterbar.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="grid gap-3 rounded-md border border-line bg-white p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-3">
                <Field label="Typ">
                  <Select
                    value={item.type}
                    onChange={(e) => update(item.id, { type: e.target.value })}
                  >
                    {COST_TYPE_PRESETS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    {!COST_TYPE_PRESETS.includes(
                      item.type as (typeof COST_TYPE_PRESETS)[number],
                    ) ? (
                      <option value={item.type}>{item.type}</option>
                    ) : null}
                  </Select>
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field label="Bezeichnung">
                  <TextInput
                    value={item.label}
                    onChange={(e) => update(item.id, { label: e.target.value })}
                    placeholder="Optional anders benennen"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Betrag">
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
                <Field label="Verteilung">
                  <Select
                    value={item.allocation}
                    onChange={(e) =>
                      update(item.id, {
                        allocation: e.target.value as CostAllocation,
                      })
                    }
                  >
                    {(Object.keys(ALLOCATION_LABELS) as CostAllocation[]).map(
                      (key) => (
                        <option key={key} value={key}>
                          {key === "percent_of_goods" && percentOfRevenue
                            ? "% vom Verkaufswert"
                            : ALLOCATION_LABELS[key]}
                        </option>
                      ),
                    )}
                  </Select>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Phase">
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
                          {PHASE_LABELS[phase]}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="danger"
                      className="shrink-0 px-2"
                      onClick={() => remove(item.id)}
                      aria-label="Entfernen"
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

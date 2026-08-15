"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CatalogProduct,
  OverheadAllocation,
  PersonnelDependency,
  PersonnelRole,
  PersonnelTeam,
} from "@/lib/types";
import {
  CURRENCIES,
  OVERHEAD_ALLOCATIONS,
  OVERHEAD_CATEGORIES,
  PERSONNEL_HIRE_FREQUENCIES,
  PERSONNEL_ROLE_TYPES,
} from "@/lib/types";
import {
  emptyPersonnelDependency,
  emptyPersonnelRole,
  employerCostPerFte,
  hireExtraPersonCost,
  recurringMonthlyTotal,
} from "@/lib/personnel";
import {
  isManualAllocationValid,
  sumManualPercents,
} from "@/lib/overhead";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import { usePrefs } from "@/context/PreferencesContext";
import Link from "next/link";
import { Button, Field, Modal, Select, TextInput } from "@/components/ui";

type Props = {
  open: boolean;
  initial: PersonnelRole | null;
  products: CatalogProduct[];
  teams: PersonnelTeam[];
  isEdit: boolean;
  defaultCurrency?: string;
  onClose: () => void;
  onSave: (role: PersonnelRole) => void;
};

export function PersonnelRoleFormModal({
  open,
  initial,
  products,
  teams,
  isEdit,
  defaultCurrency = "EUR",
  onClose,
  onSave,
}: Props) {
  const { t, locale } = useI18n();
  const { prefs } = usePrefs();
  const [draft, setDraft] = useState<PersonnelRole | null>(null);
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>(
    {},
  );

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setDraft(structuredClone(initial));
      const inputs: Record<string, string> = {};
      for (const row of initial.manuelleAufteilung ?? []) {
        inputs[row.productId] = String(row.percent);
      }
      setPercentInputs(inputs);
      return;
    }
    setDraft(emptyPersonnelRole(defaultCurrency));
    setPercentInputs({});
  }, [open, initial, defaultCurrency]);

  if (!draft) return null;

  const employer = employerCostPerFte(draft);
  const recurring = recurringMonthlyTotal(draft);
  const hire = hireExtraPersonCost(draft);
  const manualOk =
    draft.verteilschluessel !== "manuell" ||
    isManualAllocationValid(draft.manuelleAufteilung ?? []);
  const canSave =
    draft.name.trim().length > 0 &&
    draft.bruttoGehalt >= 0 &&
    draft.headcount >= 0 &&
    manualOk;

  function updateDep(id: string, patch: Partial<PersonnelDependency>) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dependencies: prev.dependencies.map((d) =>
          d.id === id ? { ...d, ...patch } : d,
        ),
      };
    });
  }

  function setAllocation(key: OverheadAllocation) {
    setDraft((prev) => {
      if (!prev) return prev;
      if (key === "manuell") {
        const shares =
          prev.manuelleAufteilung && prev.manuelleAufteilung.length > 0
            ? prev.manuelleAufteilung
            : sortedProducts.map((p) => ({ productId: p.id, percent: 0 }));
        const inputs: Record<string, string> = {};
        for (const row of shares) inputs[row.productId] = String(row.percent);
        setPercentInputs(inputs);
        return { ...prev, verteilschluessel: key, manuelleAufteilung: shares };
      }
      return { ...prev, verteilschluessel: key, manuelleAufteilung: null };
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEdit
          ? t("personnel.modal.editTitle")
          : t("personnel.modal.createTitle")
      }
      description={t("personnel.modal.description")}
      wide
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("personnel.field.name")} required>
            <TextInput
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t("personnel.field.namePlaceholder")}
            />
          </Field>
          <Field
            label={t("personnel.field.team")}
            hint={
              sortedTeams.length === 0
                ? undefined
                : t("personnel.field.teamHint")
            }
          >
            <Select
              value={draft.teamId}
              onChange={(e) =>
                setDraft({ ...draft, teamId: e.target.value })
              }
            >
              <option value="">{t("personnel.team.unassigned")}</option>
              {sortedTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
            {sortedTeams.length === 0 ? (
              <p className="mt-1 text-[12px] text-muted">
                {t("personnel.field.teamEmpty")}{" "}
                <Link href="/teams" className="text-accent hover:underline">
                  {t("nav.teams")}
                </Link>
              </p>
            ) : null}
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("personnel.field.headcount")} required>
            <TextInput
              type="number"
              min={0}
              step={0.5}
              value={draft.headcount}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  headcount: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
          <div className="hidden sm:block" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("personnel.field.roleType")}>
            <Select
              value={draft.roleType}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  roleType: e.target.value as PersonnelRole["roleType"],
                })
              }
            >
              {PERSONNEL_ROLE_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {t(`personnel.roleType.${rt}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("personnel.field.start")}>
            <TextInput
              type="date"
              value={draft.gueltigVon ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  gueltigVon: e.target.value || null,
                })
              }
            />
          </Field>
          <Field label={t("personnel.field.end")}>
            <TextInput
              type="date"
              value={draft.gueltigBis ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  gueltigBis: e.target.value || null,
                })
              }
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("personnel.field.brutto")} required>
            <TextInput
              type="number"
              min={0}
              step={100}
              value={draft.bruttoGehalt}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  bruttoGehalt: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
          <Field
            label={t("personnel.field.nebenkosten")}
            hint={t("personnel.field.nebenkostenHint")}
          >
            <TextInput
              type="number"
              min={0}
              step={0.25}
              value={draft.lohnnebenkostenPercent}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  lohnnebenkostenPercent: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
          <Field label={t("overhead.field.waehrung")} required>
            <Select
              value={draft.waehrung}
              onChange={(e) =>
                setDraft({ ...draft, waehrung: e.target.value })
              }
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label={t("personnel.field.benefits")}
            hint={t("personnel.field.benefitsHint")}
          >
            <TextInput
              type="number"
              min={0}
              step={10}
              value={draft.benefitsMonthly}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  benefitsMonthly: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
          <Field
            label={t("personnel.field.zusatzAg")}
            hint={t("personnel.field.zusatzAgHint")}
          >
            <TextInput
              type="number"
              min={0}
              step={0.25}
              value={draft.zusatzAgPercent}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  zusatzAgPercent: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
          <Field label={t("personnel.field.increase")}>
            <TextInput
              type="number"
              min={0}
              step={0.5}
              value={draft.annualIncreasePercent}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  annualIncreasePercent: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
        </div>

        {draft.roleType === "scaling" ? (
          <div className="grid gap-3 rounded-[10px] border border-line p-3 sm:grid-cols-3">
            <p className="sm:col-span-3 text-[13px] font-medium">
              {t("personnel.col.teamScaling")}
            </p>
            <Field label={t("personnel.col.hiresPerPeriod")}>
              <TextInput
                type="number"
                min={0}
                step={1}
                value={draft.hiresPerPeriod}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    hiresPerPeriod: Number(e.target.value) || 0,
                  })
                }
              />
            </Field>
            <Field label={t("personnel.col.hireFrequency")}>
              <Select
                value={draft.hireFrequency}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    hireFrequency: e.target
                      .value as PersonnelRole["hireFrequency"],
                  })
                }
              >
                {PERSONNEL_HIRE_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {t(`personnel.hireFrequency.${f}` as MessageKey)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("personnel.col.maxHeadcount")}
              hint={t("personnel.field.maxHeadcountHint")}
            >
              <TextInput
                type="number"
                min={0}
                step={1}
                value={draft.maxHeadcount ?? ""}
                placeholder={t("personnel.col.unlimited")}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({
                    ...draft,
                    maxHeadcount: v === "" ? null : Number(v) || 0,
                  });
                }}
              />
            </Field>
          </div>
        ) : null}

        <div className="rounded-[10px] border border-line bg-surface-faint px-3.5 py-3 text-[13px]">
          <p className="text-muted">{t("personnel.summary.employer")}</p>
          <p className="mt-0.5 font-medium tabular-nums text-foreground">
            {formatEuro(employer, locale)}
            <span className="ml-1 text-[12px] font-normal text-muted">
              {t("personnel.summary.perFteMonth")}
            </span>
          </p>
          <p className="mt-2 text-muted">{t("personnel.summary.recurring")}</p>
          <p className="mt-0.5 font-medium tabular-nums text-foreground">
            {formatEuro(recurring, locale)}
            <span className="ml-1 text-[12px] font-normal text-muted">
              {t("personnel.summary.perMonth")}
            </span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("overhead.field.kategorie")}>
            <Select
              value={draft.kategorie}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  kategorie: e.target.value as PersonnelRole["kategorie"],
                })
              }
            >
              {OVERHEAD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`overhead.category.${c}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("overhead.field.verteilschluessel")} required>
            <Select
              value={draft.verteilschluessel}
              onChange={(e) =>
                setAllocation(e.target.value as OverheadAllocation)
              }
            >
              {OVERHEAD_ALLOCATIONS.map((key) => (
                <option key={key} value={key}>
                  {t(`overhead.allocation.${key}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {draft.verteilschluessel === "manuell" ? (
          <div className="space-y-2 rounded-[10px] border border-line p-3">
            <p className="text-[13px] font-medium">
              {t("overhead.manual.title")}
            </p>
            <p className="text-[12px] text-muted">
              {t("overhead.manual.sum", {
                sum: String(
                  Math.round(
                    sumManualPercents(draft.manuelleAufteilung ?? []) * 100,
                  ) / 100,
                ),
              })}
            </p>
            {sortedProducts.length === 0 ? (
              <p className="text-[12px] text-muted">
                {t("overhead.manual.noProducts")}
              </p>
            ) : (
              <div className="space-y-2">
                {sortedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="truncate text-[13px]">{p.name}</span>
                    <TextInput
                      className="!w-[88px]"
                      type="text"
                      inputMode="decimal"
                      value={percentInputs[p.id] ?? "0"}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setPercentInputs((prev) => ({
                          ...prev,
                          [p.id]: raw,
                        }));
                        const n = Number(raw.replace(",", "."));
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const shares = [
                            ...(prev.manuelleAufteilung ?? []),
                          ];
                          const idx = shares.findIndex(
                            (s) => s.productId === p.id,
                          );
                          const percent = Number.isFinite(n) ? n : 0;
                          if (idx >= 0) shares[idx] = { productId: p.id, percent };
                          else shares.push({ productId: p.id, percent });
                          return { ...prev, manuelleAufteilung: shares };
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            {!manualOk ? (
              <p className="text-[12px] text-danger">
                {t("overhead.manual.must100")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-foreground">
                {t("personnel.deps.title")}
              </p>
              <p className="text-[12px] text-muted">
                {t("personnel.deps.hint")}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setDraft({
                  ...draft,
                  dependencies: [
                    ...draft.dependencies,
                    emptyPersonnelDependency(),
                  ],
                })
              }
            >
              {t("personnel.deps.add")}
            </Button>
          </div>
          {draft.dependencies.length === 0 ? (
            <p className="text-[12px] text-muted">{t("personnel.deps.empty")}</p>
          ) : (
            <div className="space-y-2">
              {draft.dependencies.map((dep) => (
                <div
                  key={dep.id}
                  className="grid gap-2 rounded-[10px] border border-line p-3 sm:grid-cols-[1fr_100px_120px_auto_auto]"
                >
                  <TextInput
                    value={dep.name}
                    placeholder={t("personnel.deps.namePlaceholder")}
                    onChange={(e) =>
                      updateDep(dep.id, { name: e.target.value })
                    }
                  />
                  <TextInput
                    type="number"
                    min={0}
                    value={dep.amount}
                    onChange={(e) =>
                      updateDep(dep.id, {
                        amount: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <Select
                    value={dep.cadence}
                    onChange={(e) =>
                      updateDep(dep.id, {
                        cadence: e.target.value as PersonnelDependency["cadence"],
                      })
                    }
                  >
                    <option value="monatlich">
                      {t("personnel.cadence.monatlich")}
                    </option>
                    <option value="einmalig">
                      {t("personnel.cadence.einmalig")}
                    </option>
                  </Select>
                  <label className="flex items-center gap-1.5 text-[12px] text-muted">
                    <input
                      type="checkbox"
                      checked={dep.scalesWithHeadcount}
                      onChange={(e) =>
                        updateDep(dep.id, {
                          scalesWithHeadcount: e.target.checked,
                        })
                      }
                    />
                    {t("personnel.deps.scales")}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        dependencies: draft.dependencies.filter(
                          (d) => d.id !== dep.id,
                        ),
                      })
                    }
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[10px] border border-dashed border-line px-3.5 py-3 text-[13px]">
          <p className="font-medium text-foreground">
            {t("personnel.hirePreview.title")}
          </p>
          <p className="mt-1 text-[12px] text-muted">
            {t("personnel.hirePreview.hint")}
          </p>
          <dl className="mt-3 grid gap-1.5 sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">{t("personnel.hirePreview.salary")}</dt>
              <dd className="tabular-nums">
                {formatEuro(hire.salary, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">
                {t("personnel.hirePreview.monthly")}
              </dt>
              <dd className="tabular-nums">
                {formatEuro(hire.monthlyPackages, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">
                {t("personnel.hirePreview.oneTime")}
              </dt>
              <dd className="tabular-nums">
                {formatEuro(hire.oneTime, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 font-medium">
              <dt>{t("personnel.hirePreview.firstMonth")}</dt>
              <dd className="tabular-nums">
                {formatEuro(hire.totalFirstMonth, locale)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              onSave({
                ...draft,
                name: draft.name.trim(),
                updatedBy: prefs.displayName || null,
              });
              onClose();
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

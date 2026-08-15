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
  withCompanyPersonnelDefaults,
} from "@/lib/personnel";
import type { PersonnelCostDefaults } from "@/lib/companySettings";
import {
  clampIsoDate,
  earlierIsoDate,
  laterIsoDate,
} from "@/lib/companySettings";
import {
  isManualAllocationValid,
  sumManualPercents,
} from "@/lib/overhead";
import { formatEuro, formatNumber } from "@/lib/format";
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
  personnelDefaults?: Partial<PersonnelCostDefaults>;
  /** Erster erlaubter Tag (Modellstart) */
  modelDateMin?: string | null;
  /** Letzter erlaubter Tag (Modellende) */
  modelDateMax?: string | null;
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
  personnelDefaults,
  modelDateMin = null,
  modelDateMax = null,
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
    const defaults: PersonnelCostDefaults = {
      lohnnebenkostenPercent: personnelDefaults?.lohnnebenkostenPercent ?? 0,
      zusatzAgPercent: personnelDefaults?.zusatzAgPercent ?? 0,
      benefitsMonthly: personnelDefaults?.benefitsMonthly ?? 0,
      annualIncreasePercent: personnelDefaults?.annualIncreasePercent ?? 3,
    };
    if (initial) {
      setDraft(
        withCompanyPersonnelDefaults(
          { ...structuredClone(initial), waehrung: defaultCurrency },
          defaults,
        ),
      );
      const inputs: Record<string, string> = {};
      for (const row of initial.manuelleAufteilung ?? []) {
        inputs[row.productId] = String(row.percent);
      }
      setPercentInputs(inputs);
      return;
    }
    setDraft(emptyPersonnelRole(defaultCurrency, defaults));
    setPercentInputs({});
  }, [open, initial, defaultCurrency, personnelDefaults]);

  if (!draft) return null;

  const costDefaults: PersonnelCostDefaults = {
    lohnnebenkostenPercent: personnelDefaults?.lohnnebenkostenPercent ?? 0,
    zusatzAgPercent: personnelDefaults?.zusatzAgPercent ?? 0,
    benefitsMonthly: personnelDefaults?.benefitsMonthly ?? 0,
    annualIncreasePercent: personnelDefaults?.annualIncreasePercent ?? 3,
  };
  const priced = withCompanyPersonnelDefaults(draft, costDefaults);
  const employer = employerCostPerFte(priced);
  const recurring = recurringMonthlyTotal(priced);
  const hire = hireExtraPersonCost(priced);
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
                <Link
                  href="/company?tab=personnel"
                  className="text-accent hover:underline"
                >
                  {t("company.section.personnel")}
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
              min={modelDateMin || undefined}
              max={
                earlierIsoDate(draft.gueltigBis, modelDateMax) || undefined
              }
              onChange={(e) =>
                setDraft({
                  ...draft,
                  gueltigVon: clampIsoDate(
                    e.target.value || null,
                    modelDateMin,
                    earlierIsoDate(draft.gueltigBis, modelDateMax),
                  ),
                })
              }
            />
          </Field>
          <Field label={t("personnel.field.end")}>
            <TextInput
              type="date"
              value={draft.gueltigBis ?? ""}
              min={
                laterIsoDate(draft.gueltigVon, modelDateMin) || undefined
              }
              max={modelDateMax || undefined}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  gueltigBis: clampIsoDate(
                    e.target.value || null,
                    laterIsoDate(draft.gueltigVon, modelDateMin),
                    modelDateMax,
                  ),
                })
              }
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>

        <div className="rounded-[10px] border border-line bg-surface-faint px-3.5 py-3">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[13px] font-medium text-foreground">
              {t("personnel.companyDefaults.title")}
            </p>
            <p className="text-[12px] text-muted-soft">
              {t("personnel.companyDefaults.hint")}{" "}
              <Link
                href="/company?tab=personnel"
                className="text-accent hover:underline"
              >
                {t("personnel.companyDefaults.personnelLink")}
              </Link>
              <span className="text-muted-soft"> · </span>
              <Link href="/company" className="text-accent hover:underline">
                {t("personnel.companyDefaults.currencyLink")}
              </Link>
            </p>
          </div>
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {(
              [
                {
                  label: t("personnel.field.nebenkosten"),
                  value: `${formatNumber(priced.lohnnebenkostenPercent, locale)} %`,
                },
                {
                  label: t("personnel.field.zusatzAg"),
                  value: `${formatNumber(priced.zusatzAgPercent, locale)} %`,
                },
                {
                  label: t("personnel.field.benefits"),
                  value: formatNumber(priced.benefitsMonthly, locale),
                },
                {
                  label: t("personnel.field.increase"),
                  value: `${formatNumber(priced.annualIncreasePercent, locale)} %`,
                },
                {
                  label: t("overhead.field.waehrung"),
                  value: defaultCurrency,
                },
              ] as const
            ).map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3"
              >
                <dt className="text-[12px] text-muted">{row.label}</dt>
                <dd className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
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
              const gueltigVon = clampIsoDate(
                draft.gueltigVon,
                modelDateMin,
                earlierIsoDate(draft.gueltigBis, modelDateMax),
              );
              const gueltigBis = clampIsoDate(
                draft.gueltigBis,
                laterIsoDate(gueltigVon, modelDateMin),
                modelDateMax,
              );
              onSave(
                withCompanyPersonnelDefaults(
                  {
                    ...draft,
                    name: draft.name.trim(),
                    waehrung: defaultCurrency,
                    gueltigVon,
                    gueltigBis,
                    updatedBy: prefs.displayName || null,
                  },
                  costDefaults,
                ),
              );
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

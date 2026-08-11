"use client";

import { useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import { useStore } from "@/context/StoreContext";
import type {
  CatalogProduct,
  Dealer,
  DealerChannel,
  SalesPlanScenario,
} from "@/lib/types";
import { DEALER_CHANNEL_LABELS, SALES_PLAN_SCENARIOS } from "@/lib/types";
import {
  actualQuantitiesForRowYear,
  actualYearTotalForRow,
  applyGrowthPercent,
  buildSalesPlanCsv,
  buildYtdForecastQuantities,
  cellsForRowYear,
  dealerIdsForProductYear,
  dealerKey,
  distributeAnnualByProfile,
  downloadSalesPlanCsv,
  getRowMeta,
  getSalesPlanQuantity,
  isPlanFrozen,
  monthKeysForYear,
  parseSalesPlanCsv,
  planQuantitiesForYear,
  plannedMarginPercent,
  resolvePlanUnitPrice,
  rowUnitCost,
  SEASON_PROFILE_IDS,
  yearTotalForRow,
  type DealerRef,
  type SeasonProfileId,
} from "@/lib/salesPlan";
import { formatEuro, formatPercent } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import {
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

type PlanRow = {
  key: string;
  product: CatalogProduct;
  dealerId: DealerRef;
  dealer: Dealer | null;
};

const CHANNELS = Object.keys(DEALER_CHANNEL_LABELS) as DealerChannel[];

export default function SalesVolumePageClient() {
  const {
    ready,
    data,
    applySalesPlanUpdates,
    upsertSalesPlanRowMeta,
    patchSalesPlanSettings,
    setSalesPlanFrozen,
    importSalesPlan,
  } = useStore();
  const { t, lang, locale } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const scenario =
    data.salesPlanSettings?.activeScenario ?? ("base" as SalesPlanScenario);
  const frozen = isPlanFrozen(data.salesPlanSettings, year, scenario);

  const [channelFilter, setChannelFilter] = useState<DealerChannel | "all">(
    "all",
  );
  const [dealerFilter, setDealerFilter] = useState<string>("all");
  const [showActualMonths, setShowActualMonths] = useState(true);
  const [onlyWithValues, setOnlyWithValues] = useState(false);
  const [seasonProfile, setSeasonProfile] =
    useState<SeasonProfileId>("even");
  const [growthPercent, setGrowthPercent] = useState("10");
  const [draftInputs, setDraftInputs] = useState<Record<string, string>>({});
  const [annualDrafts, setAnnualDrafts] = useState<Record<string, string>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [extraRows, setExtraRows] = useState<string[]>([]);
  const [addDealerFor, setAddDealerFor] = useState<string>("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const months = useMemo(() => monthKeysForYear(year), [year]);
  const yearOptions = useMemo(
    () => [currentYear - 1, currentYear, currentYear + 1, currentYear + 2],
    [currentYear],
  );

  const products = useMemo(
    () =>
      [...data.catalogProducts].sort((a, b) =>
        a.name.localeCompare(b.name, lang),
      ),
    [data.catalogProducts, lang],
  );

  const dealers = useMemo(
    () =>
      [...data.dealers].sort((a, b) => a.name.localeCompare(b.name, lang)),
    [data.dealers, lang],
  );

  const activeDealers = useMemo(
    () => dealers.filter((d) => d.status === "active"),
    [dealers],
  );

  const plan = data.salesPlan ?? [];
  const metas = data.salesPlanRowMeta ?? [];

  const rows = useMemo(() => {
    const result: PlanRow[] = [];
    for (const product of products) {
      const fromData = dealerIdsForProductYear(
        data,
        product.id,
        year,
        scenario,
      );
      const dealerIds = new Set<string>(fromData.map((d) => dealerKey(d)));
      dealerIds.add("");
      for (const extra of extraRows) {
        const [pid, dKey = ""] = extra.split("\0");
        if (pid === product.id) dealerIds.add(dKey);
      }

      for (const dKey of dealerIds) {
        const dealerId: DealerRef = dKey ? dKey : null;
        const dealer = dealerId
          ? (dealers.find((d) => d.id === dealerId) ?? null)
          : null;

        if (dealerFilter === "direct" && dealerId !== null) continue;
        if (dealerFilter !== "all" && dealerFilter !== "direct") {
          if (dealerId !== dealerFilter) continue;
        }
        if (channelFilter !== "all") {
          if (dealerId === null) continue;
          if (!dealer || dealer.channel !== channelFilter) continue;
        }

        const planTotal = yearTotalForRow(
          plan,
          product.id,
          dealerId,
          year,
          scenario,
        );
        const actualTotal = actualYearTotalForRow(
          data,
          product.id,
          dealerId,
          year,
        );
        const meta = getRowMeta(metas, product.id, dealerId, scenario);
        if (
          onlyWithValues &&
          planTotal <= 0 &&
          actualTotal <= 0 &&
          !meta
        ) {
          continue;
        }

        result.push({
          key: `${product.id}\0${dKey}\0${scenario}`,
          product,
          dealerId,
          dealer,
        });
      }
    }
    return result;
  }, [
    products,
    dealers,
    data,
    year,
    plan,
    metas,
    extraRows,
    dealerFilter,
    channelFilter,
    onlyWithValues,
    scenario,
  ]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.key === selectedKey) ?? null,
    [selectedKey, rows],
  );

  function inputKey(productId: string, dealerId: DealerRef, month: string) {
    return `${productId}\0${dealerKey(dealerId)}\0${month}\0${scenario}`;
  }

  function rowKey(productId: string, dealerId: DealerRef) {
    return `${productId}\0${dealerKey(dealerId)}\0${scenario}`;
  }

  function inputValue(
    productId: string,
    dealerId: DealerRef,
    month: string,
  ): string {
    const key = inputKey(productId, dealerId, month);
    if (Object.prototype.hasOwnProperty.call(draftInputs, key)) {
      return draftInputs[key] ?? "";
    }
    const qty = getSalesPlanQuantity(
      plan,
      productId,
      dealerId,
      month,
      scenario,
    );
    return qty > 0 ? String(qty) : "";
  }

  function commitCell(
    productId: string,
    dealerId: DealerRef,
    month: string,
    raw: string,
  ) {
    if (frozen) return;
    const key = inputKey(productId, dealerId, month);
    const trimmed = raw.trim();
    const current = getSalesPlanQuantity(
      plan,
      productId,
      dealerId,
      month,
      scenario,
    );
    const next =
      trimmed === ""
        ? 0
        : Number.isFinite(Number(trimmed))
          ? Math.max(0, Number(trimmed))
          : current;
    setDraftInputs((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    if (next === current) return;
    applySalesPlanUpdates([
      { productId, dealerId, month, quantity: next, scenario },
    ]);
  }

  function clearDraftsForRow(productId: string, dealerId: DealerRef) {
    setDraftInputs((prev) => {
      const copy = { ...prev };
      for (const month of months) {
        delete copy[inputKey(productId, dealerId, month)];
      }
      return copy;
    });
  }

  function distributeAnnual(product: CatalogProduct, dealerId: DealerRef) {
    if (frozen) return;
    const aKey = rowKey(product.id, dealerId);
    const raw = annualDrafts[aKey];
    const fromInput =
      raw != null && raw.trim() !== "" ? Number(raw) : NaN;
    const annual = Number.isFinite(fromInput)
      ? fromInput
      : yearTotalForRow(plan, product.id, dealerId, year, scenario);
    if (!(annual > 0)) return;
    const quantities = distributeAnnualByProfile(annual, seasonProfile);
    applySalesPlanUpdates(
      cellsForRowYear(product.id, dealerId, year, quantities, scenario),
    );
    setAnnualDrafts((prev) => {
      const copy = { ...prev };
      delete copy[aKey];
      return copy;
    });
    clearDraftsForRow(product.id, dealerId);
  }

  function applyRowGrowth(product: CatalogProduct, dealerId: DealerRef) {
    if (frozen) return;
    const pct = Number(growthPercent);
    if (!Number.isFinite(pct)) return;
    const current = planQuantitiesForYear(
      plan,
      product.id,
      dealerId,
      year,
      scenario,
    );
    if (current.every((q) => q <= 0)) return;
    applySalesPlanUpdates(
      cellsForRowYear(
        product.id,
        dealerId,
        year,
        applyGrowthPercent(current, pct),
        scenario,
      ),
    );
    clearDraftsForRow(product.id, dealerId);
  }

  function applyYtdForecast(product: CatalogProduct, dealerId: DealerRef) {
    if (frozen) return;
    const asOf =
      year === currentYear
        ? new Date().getMonth()
        : year < currentYear
          ? 12
          : 0;
    const actuals = actualQuantitiesForRowYear(
      data,
      product.id,
      dealerId,
      year,
    );
    const current = planQuantitiesForYear(
      plan,
      product.id,
      dealerId,
      year,
      scenario,
    );
    const next = buildYtdForecastQuantities(actuals, current, asOf);
    applySalesPlanUpdates(
      cellsForRowYear(product.id, dealerId, year, next, scenario),
    );
    clearDraftsForRow(product.id, dealerId);
  }

  function clearRow(product: CatalogProduct, dealerId: DealerRef) {
    if (frozen) return;
    applySalesPlanUpdates(
      cellsForRowYear(
        product.id,
        dealerId,
        year,
        Array.from({ length: 12 }, () => 0),
        scenario,
      ),
    );
    clearDraftsForRow(product.id, dealerId);
  }

  function copyFromPriorYearPlan(
    product: CatalogProduct,
    dealerId: DealerRef,
  ) {
    if (frozen) return;
    const prior = planQuantitiesForYear(
      plan,
      product.id,
      dealerId,
      year - 1,
      scenario,
    );
    if (prior.every((q) => q <= 0)) return;
    applySalesPlanUpdates(
      cellsForRowYear(product.id, dealerId, year, prior, scenario),
    );
    clearDraftsForRow(product.id, dealerId);
  }

  function copyFromPriorYearActual(
    product: CatalogProduct,
    dealerId: DealerRef,
  ) {
    if (frozen) return;
    const prior = actualQuantitiesForRowYear(
      data,
      product.id,
      dealerId,
      year - 1,
    );
    if (prior.every((q) => q <= 0)) return;
    applySalesPlanUpdates(
      cellsForRowYear(product.id, dealerId, year, prior, scenario),
    );
    clearDraftsForRow(product.id, dealerId);
  }

  function commitPrice(product: CatalogProduct, dealerId: DealerRef) {
    if (frozen) return;
    const key = rowKey(product.id, dealerId);
    const meta = getRowMeta(metas, product.id, dealerId, scenario);
    const raw = Object.prototype.hasOwnProperty.call(priceDrafts, key)
      ? priceDrafts[key]
      : undefined;
    const note = Object.prototype.hasOwnProperty.call(noteDrafts, key)
      ? (noteDrafts[key] ?? "")
      : (meta?.note ?? "");
    let unitPrice = meta?.unitPrice ?? null;
    if (raw !== undefined) {
      const trimmed = raw.trim();
      unitPrice =
        trimmed === ""
          ? null
          : Number.isFinite(Number(trimmed))
            ? Math.max(0, Number(trimmed))
            : meta?.unitPrice ?? null;
    }
    upsertSalesPlanRowMeta({
      productId: product.id,
      dealerId,
      scenario,
      unitPrice,
      note,
    });
    setPriceDrafts((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }

  function commitNote(product: CatalogProduct, dealerId: DealerRef) {
    if (frozen) return;
    const key = rowKey(product.id, dealerId);
    const meta = getRowMeta(metas, product.id, dealerId, scenario);
    const note = Object.prototype.hasOwnProperty.call(noteDrafts, key)
      ? (noteDrafts[key] ?? "")
      : (meta?.note ?? "");
    const priceRaw = priceDrafts[key];
    let unitPrice = meta?.unitPrice ?? null;
    if (priceRaw !== undefined) {
      const trimmed = priceRaw.trim();
      unitPrice =
        trimmed === ""
          ? null
          : Number.isFinite(Number(trimmed))
            ? Math.max(0, Number(trimmed))
            : meta?.unitPrice ?? null;
    }
    upsertSalesPlanRowMeta({
      productId: product.id,
      dealerId,
      scenario,
      unitPrice,
      note,
    });
    setNoteDrafts((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }

  function fillAllActiveDealers(product: CatalogProduct) {
    if (frozen) return;
    const aKey = rowKey(product.id, null);
    // use product-level annual from direct row draft if any
    const annualRaw = annualDrafts[aKey];
    const annual =
      annualRaw != null && annualRaw.trim() !== ""
        ? Number(annualRaw)
        : yearTotalForRow(plan, product.id, null, year, scenario);
    if (!(annual > 0) || activeDealers.length === 0) return;
    const perDealer = Math.floor(annual / activeDealers.length);
    const rem = annual - perDealer * activeDealers.length;
    const updates = activeDealers.flatMap((d, i) => {
      const qty = perDealer + (i < rem ? 1 : 0);
      return cellsForRowYear(
        product.id,
        d.id,
        year,
        distributeAnnualByProfile(qty, seasonProfile),
        scenario,
      );
    });
    applySalesPlanUpdates(updates);
    setExtraRows((prev) => {
      const next = new Set(prev);
      for (const d of activeDealers) next.add(`${product.id}\0${d.id}`);
      return [...next];
    });
  }

  function addDealerRow() {
    if (!addDealerFor) return;
    const [productId, dealerIdRaw] = addDealerFor.split("::");
    if (!productId) return;
    const dKey = dealerIdRaw === "direct" ? "" : (dealerIdRaw ?? "");
    const key = `${productId}\0${dKey}`;
    setExtraRows((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setAddDealerFor("");
  }

  function exportCsv() {
    const csv = buildSalesPlanCsv(data, year, scenario);
    downloadSalesPlanCsv(
      `absatzplan_${scenario}_${year}.csv`,
      csv,
    );
  }

  async function onImportFile(file: File) {
    const text = await file.text();
    const result = parseSalesPlanCsv(text, year, scenario);
    if (result.cells.length === 0 && result.rowMeta.length === 0) {
      setImportMsg(
        result.errors[0] ?? t("salesVolume.importEmpty"),
      );
      return;
    }
    if (frozen) {
      setImportMsg(t("salesVolume.frozenHint"));
      return;
    }
    importSalesPlan(result.cells, result.rowMeta);
    setImportMsg(
      t("salesVolume.importOk", {
        cells: String(result.cells.length),
        errors: String(result.errors.length),
      }),
    );
  }

  function formatMonthHeader(month: string) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y!, (m ?? 1) - 1, 1);
    return d.toLocaleDateString(locale, { month: "short" });
  }

  function formatQty(n: number) {
    return n > 0 ? n.toLocaleString(locale) : "—";
  }

  function deltaTone(delta: number) {
    if (delta > 0) return "text-danger";
    if (delta < 0) return "text-success";
    return "text-muted";
  }

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const addOptions = products.flatMap((p) => {
    const opts = [
      {
        value: `${p.id}::direct`,
        label: `${p.name} · ${t("salesVolume.direct")}`,
      },
      ...activeDealers
        .filter(
          (d) => channelFilter === "all" || d.channel === channelFilter,
        )
        .map((d) => ({
          value: `${p.id}::${d.id}`,
          label: `${p.name} · ${d.name}`,
        })),
    ];
    return opts;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("salesVolume.title")}
        description={t("salesVolume.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportCsv}>
              {t("salesVolume.exportCsv")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={frozen}
            >
              {t("salesVolume.importCsv")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImportFile(file);
                e.target.value = "";
              }}
            />
          </div>
        }
      />

      <Card className="!p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SALES_PLAN_SCENARIOS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => patchSalesPlanSettings({ activeScenario: s })}
              className={`rounded-[8px] px-3 py-1.5 text-[13px] transition-colors ${
                scenario === s
                  ? "bg-white font-medium text-foreground shadow-[var(--shadow-sm)]"
                  : "text-muted hover:bg-white/70 hover:text-foreground"
              }`}
            >
              {t(`salesVolume.scenario.${s}` as MessageKey)}
            </button>
          ))}
          <Button
            variant={frozen ? "secondary" : "ghost"}
            className="!h-8 !px-3 text-[12px]"
            onClick={() => setSalesPlanFrozen(year, scenario, !frozen)}
          >
            {frozen
              ? t("salesVolume.unfreeze")
              : t("salesVolume.freeze")}
          </Button>
          {frozen ? (
            <Badge tone="accent">{t("salesVolume.frozenBadge")}</Badge>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("salesVolume.year")}>
            <Select
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("salesVolume.filter.channel")}>
            <Select
              value={channelFilter}
              onChange={(e) =>
                setChannelFilter(e.target.value as DealerChannel | "all")
              }
            >
              <option value="all">{t("salesVolume.filter.allChannels")}</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {t(`dealer.channel.${c}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("salesVolume.filter.dealer")}>
            <Select
              value={dealerFilter}
              onChange={(e) => setDealerFilter(e.target.value)}
            >
              <option value="all">{t("salesVolume.filter.allDealers")}</option>
              <option value="direct">{t("salesVolume.direct")}</option>
              {activeDealers
                .filter(
                  (d) =>
                    channelFilter === "all" || d.channel === channelFilter,
                )
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t("salesVolume.season")}>
            <Select
              value={seasonProfile}
              onChange={(e) =>
                setSeasonProfile(e.target.value as SeasonProfileId)
              }
              disabled={frozen}
            >
              {SEASON_PROFILE_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`salesVolume.season.${id}` as MessageKey)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("salesVolume.growthPercent")}>
            <TextInput
              type="number"
              step="1"
              value={growthPercent}
              disabled={frozen}
              onChange={(e) => setGrowthPercent(e.target.value)}
            />
          </Field>
          <div className="flex flex-col justify-end gap-2 pb-0.5 sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={showActualMonths}
                onChange={(e) => setShowActualMonths(e.target.checked)}
              />
              {t("salesVolume.showActualMonths")}
            </label>
            <label className="flex items-center gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={onlyWithValues}
                onChange={(e) => setOnlyWithValues(e.target.checked)}
              />
              {t("salesVolume.onlyWithValues")}
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field label={t("salesVolume.addRow")}>
              <Select
                value={addDealerFor}
                onChange={(e) => setAddDealerFor(e.target.value)}
              >
                <option value="">{t("salesVolume.addRowPlaceholder")}</option>
                {addOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button
            variant="secondary"
            className="!h-10"
            disabled={!addDealerFor}
            onClick={addDealerRow}
          >
            {t("salesVolume.addRowButton")}
          </Button>
        </div>
        {importMsg ? (
          <p className="mt-2 text-[12px] text-muted">{importMsg}</p>
        ) : null}
        <p className="mt-3 text-[12px] text-muted">{t("salesVolume.hint")}</p>
      </Card>

      <Card className="!p-0 overflow-hidden">
        {products.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[14px] font-medium text-foreground">
              {t("salesVolume.emptyTitle")}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {t("salesVolume.emptyDescription")}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[14px] font-medium text-foreground">
              {t("salesVolume.emptyFilterTitle")}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {t("salesVolume.emptyFilterDescription")}
            </p>
          </div>
        ) : (
          <>
            {selectedRow ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-faint px-3 py-2">
                <p className="mr-1 min-w-0 flex-1 truncate text-[12px] text-muted">
                  <span className="font-medium text-foreground">
                    {selectedRow.product.name}
                  </span>
                  {" · "}
                  {selectedRow.dealer
                    ? selectedRow.dealer.name
                    : t("salesVolume.direct")}
                </p>
                <TextInput
                  type="number"
                  min={0}
                  step="1"
                  className="!h-8 !w-[100px] !px-2 !text-right tabular-nums"
                  disabled={frozen}
                  placeholder={t("salesVolume.annualPlaceholder")}
                  value={
                    Object.prototype.hasOwnProperty.call(
                      annualDrafts,
                      rowKey(selectedRow.product.id, selectedRow.dealerId),
                    )
                      ? (annualDrafts[
                          rowKey(selectedRow.product.id, selectedRow.dealerId)
                        ] ?? "")
                      : yearTotalForRow(
                            plan,
                            selectedRow.product.id,
                            selectedRow.dealerId,
                            year,
                            scenario,
                          ) > 0
                        ? String(
                            yearTotalForRow(
                              plan,
                              selectedRow.product.id,
                              selectedRow.dealerId,
                              year,
                              scenario,
                            ),
                          )
                        : ""
                  }
                  onChange={(e) =>
                    setAnnualDrafts((prev) => ({
                      ...prev,
                      [rowKey(
                        selectedRow.product.id,
                        selectedRow.dealerId,
                      )]: e.target.value,
                    }))
                  }
                />
                <Button
                  variant="secondary"
                  className="!h-8 !px-2 text-[11px]"
                  disabled={frozen}
                  onClick={() =>
                    distributeAnnual(
                      selectedRow.product,
                      selectedRow.dealerId,
                    )
                  }
                >
                  {t("salesVolume.distribute")}
                </Button>
                <Button
                  variant="ghost"
                  className="!h-8 !px-2 text-[11px]"
                  disabled={frozen}
                  onClick={() =>
                    copyFromPriorYearPlan(
                      selectedRow.product,
                      selectedRow.dealerId,
                    )
                  }
                >
                  {t("salesVolume.copyPriorPlan")}
                </Button>
                <Button
                  variant="ghost"
                  className="!h-8 !px-2 text-[11px]"
                  disabled={frozen}
                  onClick={() =>
                    copyFromPriorYearActual(
                      selectedRow.product,
                      selectedRow.dealerId,
                    )
                  }
                >
                  {t("salesVolume.copyPriorActual")}
                </Button>
                <Button
                  variant="ghost"
                  className="!h-8 !px-2 text-[11px]"
                  disabled={frozen}
                  onClick={() =>
                    applyRowGrowth(selectedRow.product, selectedRow.dealerId)
                  }
                >
                  {t("salesVolume.applyGrowth")}
                </Button>
                <Button
                  variant="ghost"
                  className="!h-8 !px-2 text-[11px]"
                  disabled={frozen}
                  onClick={() =>
                    applyYtdForecast(
                      selectedRow.product,
                      selectedRow.dealerId,
                    )
                  }
                >
                  {t("salesVolume.ytdForecast")}
                </Button>
                <Button
                  variant="ghost"
                  className="!h-8 !px-2 text-[11px]"
                  disabled={frozen}
                  onClick={() =>
                    clearRow(selectedRow.product, selectedRow.dealerId)
                  }
                >
                  {t("salesVolume.clearRow")}
                </Button>
                {selectedRow.dealerId === null ? (
                  <Button
                    variant="ghost"
                    className="!h-8 !px-2 text-[11px]"
                    disabled={frozen}
                    onClick={() => fillAllActiveDealers(selectedRow.product)}
                  >
                    {t("salesVolume.fillDealers")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="border-b border-line bg-surface-faint px-3 py-2">
                <p className="text-[12px] text-muted">
                  {t("salesVolume.selectRowHint")}
                </p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="bg-surface-faint">
                    <th className="sticky left-0 z-20 border border-line bg-surface-faint px-2 py-1.5 text-[11px] font-medium text-muted-soft">
                      {t("salesVolume.col.product")}
                    </th>
                    <th className="sticky left-[140px] z-20 border border-line bg-surface-faint px-2 py-1.5 text-[11px] font-medium text-muted-soft">
                      {t("salesVolume.col.dealer")}
                    </th>
                    <th className="border border-line px-1 py-1.5 text-right text-[11px] font-medium text-muted-soft">
                      {t("salesVolume.col.planPrice")}
                    </th>
                    <th className="border border-line px-1 py-1.5 text-right text-[11px] font-medium text-muted-soft">
                      {t("salesVolume.col.margin")}
                    </th>
                    {months.map((month) => (
                      <th
                        key={month}
                        className="border border-line px-0 py-1.5 text-center text-[11px] font-medium text-muted-soft"
                      >
                        {formatMonthHeader(month)}
                      </th>
                    ))}
                    <th className="border border-line px-2 py-1.5 text-right text-[11px] font-medium text-muted-soft">
                      {t("salesVolume.col.planYear")}
                    </th>
                    <th className="border border-line px-2 py-1.5 text-right text-[11px] font-medium text-muted-soft">
                      {t("salesVolume.col.actualYear")}
                    </th>
                    <th className="border border-line px-2 py-1.5 text-right text-[11px] font-medium text-muted-soft">
                      {t("salesVolume.col.delta")}
                    </th>
                    <th className="border border-line px-2 py-1.5 text-[11px] font-medium text-muted-soft">
                      {t("salesVolume.col.note")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const planTotal = yearTotalForRow(
                      plan,
                      row.product.id,
                      row.dealerId,
                      year,
                      scenario,
                    );
                    const actualTotal = actualYearTotalForRow(
                      data,
                      row.product.id,
                      row.dealerId,
                      year,
                    );
                    const delta = actualTotal - planTotal;
                    const actualMonths = showActualMonths
                      ? actualQuantitiesForRowYear(
                          data,
                          row.product.id,
                          row.dealerId,
                          year,
                        )
                      : null;
                    const aKey = rowKey(row.product.id, row.dealerId);
                    const meta = getRowMeta(
                      metas,
                      row.product.id,
                      row.dealerId,
                      scenario,
                    );
                    const unitPrice = resolvePlanUnitPrice(
                      data,
                      row.product.id,
                      row.dealerId,
                      scenario,
                    );
                    const unitCost = rowUnitCost(
                      row.product.id,
                      data.components,
                      data.productComponents ?? [],
                    );
                    const margin = plannedMarginPercent(unitPrice, unitCost);
                    const target = row.product.targetMarginPercent;
                    const marginOk =
                      margin == null || target == null
                        ? null
                        : margin + 0.05 >= target;
                    const selected = selectedKey === row.key;

                    return (
                      <tr
                        key={row.key}
                        onClick={() => setSelectedKey(row.key)}
                        className={`cursor-pointer ${
                          selected ? "bg-accent-soft/40" : "hover:bg-surface-faint"
                        }`}
                      >
                        <td
                          className={`sticky left-0 z-10 w-[140px] max-w-[140px] border border-line px-2 py-0 ${
                            selected ? "bg-accent-soft/40" : "bg-white"
                          }`}
                        >
                          <p className="truncate text-[12px] font-medium text-foreground">
                            {row.product.name || "—"}
                          </p>
                          <p className="truncate text-[10px] text-muted-soft">
                            {row.product.sku || "—"}
                          </p>
                        </td>
                        <td
                          className={`sticky left-[140px] z-10 w-[120px] max-w-[120px] border border-line px-2 py-0 ${
                            selected ? "bg-accent-soft/40" : "bg-white"
                          }`}
                        >
                          <p className="truncate text-[12px] text-foreground">
                            {row.dealer
                              ? row.dealer.name
                              : t("salesVolume.direct")}
                          </p>
                        </td>
                        <td className="border border-line p-0">
                          <SheetInput
                            type="number"
                            min={0}
                            step="0.01"
                            disabled={frozen}
                            title={formatEuro(unitPrice * planTotal, locale)}
                            value={
                              Object.prototype.hasOwnProperty.call(
                                priceDrafts,
                                aKey,
                              )
                                ? (priceDrafts[aKey] ?? "")
                                : meta?.unitPrice != null
                                  ? String(meta.unitPrice)
                                  : ""
                            }
                            placeholder={
                              unitPrice > 0 ? String(unitPrice) : ""
                            }
                            onChange={(e) =>
                              setPriceDrafts((prev) => ({
                                ...prev,
                                [aKey]: e.target.value,
                              }))
                            }
                            onBlur={() =>
                              commitPrice(row.product, row.dealerId)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="border border-line px-1.5 py-1 text-right tabular-nums">
                          {margin == null ? (
                            <span className="text-muted-soft">—</span>
                          ) : (
                            <span
                              className={
                                marginOk === false
                                  ? "font-medium text-danger"
                                  : marginOk === true
                                    ? "text-success"
                                    : "text-foreground"
                              }
                              title={
                                target != null
                                  ? `${t("salesVolume.targetMargin")}: ${formatPercent(target, locale)}`
                                  : undefined
                              }
                            >
                              {formatPercent(margin, locale)}
                            </span>
                          )}
                        </td>
                        {months.map((month, mi) => {
                          const act = actualMonths?.[mi] ?? 0;
                          return (
                            <td
                              key={month}
                              className="border border-line p-0 align-middle"
                            >
                              <SheetInput
                                type="number"
                                min={0}
                                step="1"
                                disabled={frozen}
                                value={inputValue(
                                  row.product.id,
                                  row.dealerId,
                                  month,
                                )}
                                placeholder=""
                                title={
                                  showActualMonths
                                    ? `${t("salesVolume.actualShort")}: ${formatQty(act)}`
                                    : undefined
                                }
                                onChange={(e) =>
                                  setDraftInputs((prev) => ({
                                    ...prev,
                                    [inputKey(
                                      row.product.id,
                                      row.dealerId,
                                      month,
                                    )]: e.target.value,
                                  }))
                                }
                                onBlur={(e) =>
                                  commitCell(
                                    row.product.id,
                                    row.dealerId,
                                    month,
                                    e.target.value,
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              {showActualMonths && act > 0 ? (
                                <div className="border-t border-line/70 px-1 py-0.5 text-right text-[9px] tabular-nums text-muted-soft">
                                  {act.toLocaleString(locale)}
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                        <td className="border border-line px-2 py-1 text-right tabular-nums font-medium">
                          {formatQty(planTotal)}
                        </td>
                        <td className="border border-line px-2 py-1 text-right tabular-nums text-muted">
                          {formatQty(actualTotal)}
                        </td>
                        <td
                          className={`border border-line px-2 py-1 text-right tabular-nums font-medium ${deltaTone(delta)}`}
                        >
                          {planTotal === 0 && actualTotal === 0
                            ? "—"
                            : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toLocaleString(locale)}`}
                        </td>
                        <td className="border border-line p-0">
                          <SheetInput
                            className="!text-left"
                            disabled={frozen}
                            placeholder=""
                            value={
                              Object.prototype.hasOwnProperty.call(
                                noteDrafts,
                                aKey,
                              )
                                ? (noteDrafts[aKey] ?? "")
                                : (meta?.note ?? "")
                            }
                            onChange={(e) =>
                              setNoteDrafts((prev) => ({
                                ...prev,
                                [aKey]: e.target.value,
                              }))
                            }
                            onBlur={() =>
                              commitNote(row.product, row.dealerId)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <p className="text-[12px] text-muted">{t("salesVolume.footer")}</p>
    </div>
  );
}

function SheetInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-8 w-full min-w-[52px] border-0 bg-transparent px-1.5 text-right text-[12px] tabular-nums text-foreground outline-none placeholder:text-muted-soft focus:bg-accent-soft/50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    />
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type {
  CostAllocation,
  CostPhase,
  LogisticsBuildingBlock,
  LogisticsTemplate,
  LogisticsTemplateItem,
} from "@/lib/types";
import {
  INCOTERMS,
  LOGISTICS_PHASES,
} from "@/lib/types";
import { formatEuro } from "@/lib/format";
import {
  emptyLogisticsBuildingBlock,
  emptyLogisticsTemplate,
  emptyLogisticsTemplateItem,
} from "@/lib/logistics";
import { useI18n } from "@/hooks/useI18n";
import { CountryFlag } from "@/components/CountryFlag";
import {
  Button,
  ConfirmDialog,
  Field,
  Modal,
  PageHeader,
  Select,
  TableRowActions,
  TextArea,
  TextInput,
} from "@/components/ui";

type Tab = "blocks" | "templates";

export default function LogisticsPageClient() {
  const {
    ready,
    data,
    upsertLogisticsBuildingBlock,
    deleteLogisticsBuildingBlock,
    upsertLogisticsTemplate,
    deleteLogisticsTemplate,
    linkedTemplateNamesForBuildingBlock,
  } = useStore();
  const { t, locale, lang, phaseLabel, allocationLabel, countryLabel } =
    useI18n();
  const [tab, setTab] = useState<Tab>("blocks");
  const [blockDraft, setBlockDraft] = useState<LogisticsBuildingBlock | null>(
    null,
  );
  const [templateDraft, setTemplateDraft] =
    useState<LogisticsTemplate | null>(null);
  const [deleteBlock, setDeleteBlock] =
    useState<LogisticsBuildingBlock | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<{
    name: string;
    templates: string[];
  } | null>(null);
  const [deleteTemplate, setDeleteTemplate] =
    useState<LogisticsTemplate | null>(null);

  const blocks = useMemo(
    () =>
      [...(data.logisticsBuildingBlocks ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, lang),
      ),
    [data.logisticsBuildingBlocks, lang],
  );

  const templates = useMemo(
    () =>
      [...(data.logisticsTemplates ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, lang),
      ),
    [data.logisticsTemplates, lang],
  );

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const blockIsEdit = Boolean(
    blockDraft && blocks.some((b) => b.id === blockDraft.id),
  );
  const templateIsEdit = Boolean(
    templateDraft && templates.some((tpl) => tpl.id === templateDraft.id),
  );

  function tryDeleteBlock(block: LogisticsBuildingBlock) {
    const linked = linkedTemplateNamesForBuildingBlock(block.id);
    if (linked.length > 0) {
      setDeleteBlocked({ name: block.name, templates: linked });
      return;
    }
    setDeleteBlock(block);
  }

  return (
    <div>
      <PageHeader
        title={t("logistics.title")}
        description={t("logistics.description")}
        action={
          tab === "blocks" ? (
            <Button onClick={() => setBlockDraft(emptyLogisticsBuildingBlock())}>
              {t("logistics.addBlock")}
            </Button>
          ) : (
            <Button onClick={() => setTemplateDraft(emptyLogisticsTemplate())}>
              {t("logistics.addTemplate")}
            </Button>
          )
        }
      />

      <div className="mb-4 flex rounded-[8px] border border-line bg-white p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setTab("blocks")}
          className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium ${
            tab === "blocks"
              ? "bg-surface-soft text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          {t("logistics.tab.blocks")}
        </button>
        <button
          type="button"
          onClick={() => setTab("templates")}
          className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium ${
            tab === "templates"
              ? "bg-surface-soft text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          {t("logistics.tab.templates")}
        </button>
      </div>

      <BuildingBlockFormModal
        open={Boolean(blockDraft)}
        initial={blockDraft}
        isEdit={blockIsEdit}
        onClose={() => setBlockDraft(null)}
        onSave={(block) => {
          upsertLogisticsBuildingBlock(block);
          setBlockDraft(null);
        }}
      />

      <TemplateFormModal
        open={Boolean(templateDraft)}
        initial={templateDraft}
        isEdit={templateIsEdit}
        blocks={blocks}
        suppliers={data.suppliers}
        onClose={() => setTemplateDraft(null)}
        onSave={(tpl) => {
          upsertLogisticsTemplate(tpl);
          setTemplateDraft(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteBlock)}
        onClose={() => setDeleteBlock(null)}
        title={t("logistics.deleteBlockTitle")}
        description={
          deleteBlock
            ? t("logistics.deleteBlockDescription", { name: deleteBlock.name })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
        onConfirm={() => {
          if (deleteBlock) deleteLogisticsBuildingBlock(deleteBlock.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteBlocked)}
        onClose={() => setDeleteBlocked(null)}
        title={t("logistics.deleteBlockBlockedTitle")}
        description={
          deleteBlocked
            ? t("logistics.deleteBlockBlockedDescription", {
                name: deleteBlocked.name,
                templates: deleteBlocked.templates.join(", "),
              })
            : ""
        }
        confirmLabel={t("common.close")}
        danger={false}
        onConfirm={() => setDeleteBlocked(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTemplate)}
        onClose={() => setDeleteTemplate(null)}
        title={t("logistics.deleteTemplateTitle")}
        description={
          deleteTemplate
            ? t("logistics.deleteTemplateDescription", {
                name: deleteTemplate.name,
              })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
        onConfirm={() => {
          if (deleteTemplate) deleteLogisticsTemplate(deleteTemplate.id);
        }}
      />

      {tab === "blocks" ? (
        blocks.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">
            {t("logistics.blocksEmpty")}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    <th className="px-4 py-2.5 font-medium">
                      {t("logistics.col.name")}
                    </th>
                    <th className="px-4 py-2.5 font-medium">
                      {t("logistics.col.phase")}
                    </th>
                    <th className="px-4 py-2.5 font-medium">
                      {t("logistics.col.allocation")}
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {t("logistics.col.defaultAmount")}
                    </th>
                    <th className="w-28 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block) => (
                    <tr
                      key={block.id}
                      className="border-b border-line last:border-0 hover:bg-surface-faint"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-left font-medium text-foreground hover:text-accent"
                          onClick={() => setBlockDraft(structuredClone(block))}
                        >
                          {block.name}
                        </button>
                        {block.notes ? (
                          <p className="mt-0.5 text-[12px] text-muted-soft">
                            {block.notes}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {phaseLabel(block.phase)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {allocationLabel(block.allocation)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {block.defaultAmount != null
                          ? block.allocation === "percent_of_goods"
                            ? `${block.defaultAmount} %`
                            : formatEuro(block.defaultAmount, locale)
                          : t("common.emDash")}
                      </td>
                      <td className="px-2 py-3">
                        <TableRowActions
                          onEdit={() => setBlockDraft(structuredClone(block))}
                          onDelete={() => tryDeleteBlock(block)}
                          editLabel={t("common.edit")}
                          deleteLabel={t("common.delete")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : templates.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">
          {t("logistics.templatesEmpty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  <th className="px-4 py-2.5 font-medium">
                    {t("logistics.col.name")}
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    {t("logistics.col.route")}
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    {t("logistics.col.incoterm")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("logistics.col.items")}
                  </th>
                  <th className="w-28 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => {
                  const supplier = data.suppliers.find(
                    (s) => s.id === tpl.supplierId,
                  );
                  return (
                    <tr
                      key={tpl.id}
                      className="border-b border-line last:border-0 hover:bg-surface-faint"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-left font-medium text-foreground hover:text-accent"
                          onClick={() =>
                            setTemplateDraft(structuredClone(tpl))
                          }
                        >
                          {tpl.name}
                        </button>
                        {supplier ? (
                          <p className="mt-0.5 text-[12px] text-muted-soft">
                            {supplier.name}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          {tpl.originCountry ? (
                            <CountryFlag code={tpl.originCountry} />
                          ) : null}
                          {tpl.originCountry
                            ? countryLabel(tpl.originCountry)
                            : t("common.emDash")}
                          {" → "}
                          {tpl.destinationCountry ? (
                            <CountryFlag code={tpl.destinationCountry} />
                          ) : null}
                          {tpl.destinationCountry
                            ? countryLabel(tpl.destinationCountry)
                            : t("common.emDash")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {tpl.incoterm || t("common.emDash")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {tpl.items.length}
                      </td>
                      <td className="px-2 py-3">
                        <TableRowActions
                          onEdit={() =>
                            setTemplateDraft(structuredClone(tpl))
                          }
                          onDelete={() => setDeleteTemplate(tpl)}
                          editLabel={t("common.edit")}
                          deleteLabel={t("common.delete")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BuildingBlockFormModal({
  open,
  initial,
  isEdit,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: LogisticsBuildingBlock | null;
  isEdit: boolean;
  onClose: () => void;
  onSave: (block: LogisticsBuildingBlock) => void;
}) {
  const { t, phaseLabel, allocationLabel } = useI18n();
  const [draft, setDraft] = useState<LogisticsBuildingBlock | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      return;
    }
    setDraft(initial ? structuredClone(initial) : null);
  }, [open, initial]);

  if (!open || !draft) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEdit ? t("logistics.blockEditTitle") : t("logistics.blockCreateTitle")
      }
    >
      <div className="space-y-3">
        <Field label={t("logistics.col.name")} required>
          <TextInput
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("logistics.col.phase")}>
            <Select
              value={draft.phase}
              onChange={(e) =>
                setDraft({ ...draft, phase: e.target.value as CostPhase })
              }
            >
              {LOGISTICS_PHASES.map((p) => (
                <option key={p} value={p}>
                  {phaseLabel(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("logistics.col.allocation")}>
            <Select
              value={draft.allocation}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  allocation: e.target.value as CostAllocation,
                })
              }
            >
              {(
                ["lump_sum", "per_unit", "percent_of_goods"] as CostAllocation[]
              ).map((a) => (
                <option key={a} value={a}>
                  {allocationLabel(a)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("logistics.col.defaultAmount")}>
          <TextInput
            type="number"
            step="0.01"
            min="0"
            value={draft.defaultAmount ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                defaultAmount:
                  e.target.value === "" ? null : Number(e.target.value) || 0,
              })
            }
            placeholder={t("logistics.amountOptional")}
          />
        </Field>
        <Field label={t("logistics.col.notes")}>
          <TextArea
            rows={2}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!draft.name.trim()}
            onClick={() =>
              onSave({
                ...draft,
                name: draft.name.trim(),
                notes: draft.notes.trim(),
              })
            }
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TemplateFormModal({
  open,
  initial,
  isEdit,
  blocks,
  suppliers,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: LogisticsTemplate | null;
  isEdit: boolean;
  blocks: LogisticsBuildingBlock[];
  suppliers: { id: string; name: string; country: string }[];
  onClose: () => void;
  onSave: (template: LogisticsTemplate) => void;
}) {
  const { t, locale, lang, countryLabel, allocationLabel } = useI18n();
  const [draft, setDraft] = useState<LogisticsTemplate | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      return;
    }
    setDraft(initial ? structuredClone(initial) : null);
  }, [open, initial]);

  if (!open || !draft) return null;

  function updateItem(id: string, patch: Partial<LogisticsTemplateItem>) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item) =>
              item.id === id ? { ...item, ...patch } : item,
            ),
          }
        : prev,
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEdit
          ? t("logistics.templateEditTitle")
          : t("logistics.templateCreateTitle")
      }
    >
      <div className="space-y-3">
        <Field label={t("logistics.col.name")} required>
          <TextInput
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("logistics.col.incoterm")}>
            <Select
              value={draft.incoterm}
              onChange={(e) =>
                setDraft({ ...draft, incoterm: e.target.value })
              }
            >
              <option value="">{t("logistics.any")}</option>
              {INCOTERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("logistics.col.supplier")}>
            <Select
              value={draft.supplierId}
              onChange={(e) =>
                setDraft({ ...draft, supplierId: e.target.value })
              }
            >
              <option value="">{t("logistics.any")}</option>
              {[...suppliers]
                .sort((a, b) => a.name.localeCompare(b.name, lang))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t("logistics.col.origin")}>
            <Select
              value={draft.originCountry}
              onChange={(e) =>
                setDraft({ ...draft, originCountry: e.target.value })
              }
            >
              <option value="">{t("logistics.any")}</option>
              {Array.from(
                new Set(
                  suppliers.map((s) => s.country).filter(Boolean),
                ),
              )
                .sort((a, b) =>
                  countryLabel(a).localeCompare(countryLabel(b), locale),
                )
                .map((code) => (
                  <option key={code} value={code}>
                    {countryLabel(code)}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t("logistics.col.destination")}>
            <Select
              value={draft.destinationCountry}
              onChange={(e) =>
                setDraft({ ...draft, destinationCountry: e.target.value })
              }
            >
              <option value="">{t("logistics.any")}</option>
              <option value="DE">{countryLabel("DE")}</option>
              <option value="AT">{countryLabel("AT")}</option>
              <option value="CH">{countryLabel("CH")}</option>
              <option value="NL">{countryLabel("NL")}</option>
            </Select>
          </Field>
        </div>

        <div className="rounded-[10px] border border-line p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-foreground">
              {t("logistics.templateItems")}
            </p>
            <Button
              variant="secondary"
              disabled={blocks.length === 0}
              onClick={() =>
                setDraft({
                  ...draft,
                  items: [
                    ...draft.items,
                    emptyLogisticsTemplateItem(blocks[0]?.id ?? ""),
                  ],
                })
              }
            >
              {t("logistics.addItem")}
            </Button>
          </div>
          {blocks.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-muted">
              {t("logistics.needBlocksFirst")}
            </p>
          ) : draft.items.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-muted">
              {t("logistics.templateItemsEmpty")}
            </p>
          ) : (
            <div className="space-y-2">
              {draft.items.map((item, index) => {
                const block = blocks.find((b) => b.id === item.buildingBlockId);
                return (
                  <div
                    key={item.id}
                    className="grid gap-2 rounded-[8px] border border-line bg-surface-faint p-2 sm:grid-cols-[auto_1.4fr_0.8fr_auto]"
                  >
                    <span className="flex h-9 w-7 items-center justify-center text-[12px] text-muted-soft">
                      {index + 1}
                    </span>
                    <Select
                      value={item.buildingBlockId}
                      onChange={(e) =>
                        updateItem(item.id, {
                          buildingBlockId: e.target.value,
                        })
                      }
                    >
                      {blocks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                    <TextInput
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.amountOverride ?? ""}
                      onChange={(e) =>
                        updateItem(item.id, {
                          amountOverride:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value) || 0,
                        })
                      }
                      placeholder={
                        block?.defaultAmount != null
                          ? String(block.defaultAmount)
                          : t("logistics.amountOptional")
                      }
                    />
                    <Button
                      variant="danger"
                      className="h-9 px-2"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          items: draft.items.filter((x) => x.id !== item.id),
                        })
                      }
                    >
                      ×
                    </Button>
                    {block ? (
                      <p className="sm:col-span-4 pl-7 text-[11px] text-muted-soft">
                        {allocationLabel(block.allocation)}
                        {block.defaultAmount != null
                          ? ` · Default ${
                              block.allocation === "percent_of_goods"
                                ? `${block.defaultAmount} %`
                                : formatEuro(block.defaultAmount, locale)
                            }`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Field label={t("logistics.col.notes")}>
          <TextArea
            rows={2}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!draft.name.trim() || draft.items.length === 0}
            onClick={() =>
              onSave({
                ...draft,
                name: draft.name.trim(),
                notes: draft.notes.trim(),
                items: draft.items.filter((i) => i.buildingBlockId),
              })
            }
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

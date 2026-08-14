import { createId } from "./format";
import type {
  CostAllocation,
  CostItem,
  CostPhase,
  LogisticsBuildingBlock,
  LogisticsTemplate,
  LogisticsTemplateItem,
} from "./types";
import { LOGISTICS_PHASES } from "./types";

export function emptyLogisticsBuildingBlock(): LogisticsBuildingBlock {
  return {
    id: createId("lbb"),
    name: "",
    phase: "transport",
    allocation: "lump_sum",
    defaultAmount: null,
    notes: "",
  };
}

export function emptyLogisticsTemplate(): LogisticsTemplate {
  return {
    id: createId("ltpl"),
    name: "",
    incoterm: "",
    originCountry: "",
    destinationCountry: "",
    supplierId: "",
    notes: "",
    items: [],
  };
}

export function emptyLogisticsTemplateItem(
  buildingBlockId = "",
): LogisticsTemplateItem {
  return {
    id: createId("lti"),
    buildingBlockId,
    amountOverride: null,
  };
}

function normalizePhase(value: unknown): CostPhase {
  if (
    value === "einkauf" ||
    value === "transport" ||
    value === "lager" ||
    value === "vertrieb"
  ) {
    return value;
  }
  return "transport";
}

function normalizeAllocation(value: unknown): CostAllocation {
  if (
    value === "per_unit" ||
    value === "lump_sum" ||
    value === "percent_of_goods"
  ) {
    return value;
  }
  return "lump_sum";
}

export function normalizeLogisticsBuildingBlock(
  raw: Partial<LogisticsBuildingBlock> & Record<string, unknown>,
): LogisticsBuildingBlock {
  const phase = normalizePhase(raw.phase);
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId("lbb"),
    name: typeof raw.name === "string" ? raw.name : "",
    phase: LOGISTICS_PHASES.includes(phase) ? phase : "transport",
    allocation: normalizeAllocation(raw.allocation),
    defaultAmount:
      raw.defaultAmount === null || raw.defaultAmount === undefined
        ? null
        : Number(raw.defaultAmount) || 0,
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

export function normalizeLogisticsTemplate(
  raw: Partial<LogisticsTemplate> & Record<string, unknown>,
): LogisticsTemplate {
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId("ltpl"),
    name: typeof raw.name === "string" ? raw.name : "",
    incoterm: typeof raw.incoterm === "string" ? raw.incoterm : "",
    originCountry:
      typeof raw.originCountry === "string" ? raw.originCountry : "",
    destinationCountry:
      typeof raw.destinationCountry === "string"
        ? raw.destinationCountry
        : "",
    supplierId: typeof raw.supplierId === "string" ? raw.supplierId : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    items: itemsRaw.map((item) => {
      const row = (item ?? {}) as Partial<LogisticsTemplateItem>;
      return {
        id: typeof row.id === "string" && row.id ? row.id : createId("lti"),
        buildingBlockId:
          typeof row.buildingBlockId === "string" ? row.buildingBlockId : "",
        amountOverride:
          row.amountOverride === null || row.amountOverride === undefined
            ? null
            : Number(row.amountOverride) || 0,
      };
    }),
  };
}

/** Vorlage → CostItems für Batch.costItems (Beschaffung/Logistik). */
export function logisticsTemplateToCostItems(
  template: LogisticsTemplate,
  blocks: LogisticsBuildingBlock[],
): CostItem[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const out: CostItem[] = [];
  for (const item of template.items) {
    const block = byId.get(item.buildingBlockId);
    if (!block) continue;
    const amount =
      item.amountOverride != null
        ? item.amountOverride
        : (block.defaultAmount ?? 0);
    out.push({
      id: createId("cost"),
      type: block.name,
      label: block.name,
      amount,
      allocation: block.allocation,
      phase: block.phase,
    });
  }
  return out;
}

/** Sinnvolle Vorlagen-Vorschläge für eine Charge (Incoterm/Lieferant/Land). */
export function rankLogisticsTemplates(
  templates: LogisticsTemplate[],
  ctx: {
    supplierId?: string;
    supplierCountry?: string;
    incoterm?: string;
  },
): LogisticsTemplate[] {
  return [...templates]
    .map((tpl) => {
      let score = 0;
      if (tpl.supplierId && ctx.supplierId && tpl.supplierId === ctx.supplierId) {
        score += 4;
      }
      if (
        tpl.incoterm &&
        ctx.incoterm &&
        tpl.incoterm === ctx.incoterm
      ) {
        score += 3;
      }
      if (
        tpl.originCountry &&
        ctx.supplierCountry &&
        tpl.originCountry === ctx.supplierCountry
      ) {
        score += 2;
      }
      if (
        !tpl.supplierId &&
        !tpl.incoterm &&
        !tpl.originCountry &&
        !tpl.destinationCountry
      ) {
        score += 0;
      }
      return { tpl, score };
    })
    .sort((a, b) => b.score - a.score || a.tpl.name.localeCompare(b.tpl.name))
    .map((x) => x.tpl);
}

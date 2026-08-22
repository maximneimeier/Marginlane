"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import {
  MODULE_HOME,
  usePrefs,
  type AppModule,
} from "@/context/PreferencesContext";
import { isCosterraAppModule } from "@/lib/costerraMode";
import { useI18n } from "@/hooks/useI18n";
import {
  Button,
  ConfirmDialog,
  PageHeader,
  TextInput,
  TrashIcon,
} from "@/components/ui";

type ProjectMeta = {
  id: string;
  name: string;
  module: AppModule;
  createdAt: string;
  updatedAt: string;
  companyName: string | null;
  baseCurrency: string | null;
  batchCount: number;
  productCount: number;
  supplierCount: number;
  componentCount: number;
  overheadCount: number;
  personnelCount: number;
  cogsLineCount: number;
};

type SortKey =
  | "name"
  | "company"
  | "currency"
  | "batches"
  | "products"
  | "suppliers"
  | "overhead"
  | "personnel"
  | "cogs"
  | "updatedAt"
  | "createdAt";

function isAppModule(value: string): value is AppModule {
  return (
    value === "invest" ||
    value === "batches" ||
    value === "batches_wholesale"
  );
}

export default function ProjectListPageClient() {
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-[13px] text-muted">…</p>
      }
    >
      <ProjectListInner />
    </Suspense>
  );
}

function ProjectListInner() {
  const params = useParams<{ module: string }>();
  const moduleParam = typeof params.module === "string" ? params.module : "";
  const module = isAppModule(moduleParam) ? moduleParam : null;
  const { ready: prefsReady, prefs, openProject, clearActiveProject } =
    usePrefs();
  const { t, locale, lang } = useI18n();
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectMeta | null>(null);

  const productTitle =
    module === "invest"
      ? t("moduleChooser.invest.title")
      : module === "batches_wholesale"
        ? t("moduleChooser.batchesWholesale.title")
        : module === "batches"
          ? t("moduleChooser.batchesManufacturing.title")
          : "";

  const reload = useCallback(async () => {
    if (!module) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces?module=${module}`);
      if (!res.ok) throw new Error("list failed");
      setProjects((await res.json()) as ProjectMeta[]);
    } catch (error) {
      console.error(error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    if (!prefsReady || !module) return;
    void reload();
  }, [prefsReady, module, reload]);

  useEffect(() => {
    if (prefsReady && !module) {
      router.replace("/");
    }
  }, [prefsReady, module, router]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "updatedAt" || key === "createdAt" ? "desc" : "asc");
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.companyName ?? "").toLowerCase().includes(q) ||
        (p.baseCurrency ?? "").toLowerCase().includes(q)
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const cmp = (av: string | number, bv: string | number) => {
        if (typeof av === "number" && typeof bv === "number") {
          return (av - bv) * dir;
        }
        return (
          String(av).localeCompare(String(bv), lang, { sensitivity: "base" }) *
          dir
        );
      };
      switch (sortKey) {
        case "company":
          return cmp(a.companyName ?? "", b.companyName ?? "");
        case "currency":
          return cmp(a.baseCurrency ?? "", b.baseCurrency ?? "");
        case "batches":
          return cmp(a.batchCount, b.batchCount);
        case "products":
          return cmp(a.productCount, b.productCount);
        case "suppliers":
          return cmp(a.supplierCount, b.supplierCount);
        case "overhead":
          return cmp(a.overheadCount, b.overheadCount);
        case "personnel":
          return cmp(a.personnelCount, b.personnelCount);
        case "cogs":
          return cmp(a.cogsLineCount, b.cogsLineCount);
        case "updatedAt":
          return cmp(a.updatedAt, b.updatedAt);
        case "createdAt":
          return cmp(a.createdAt, b.createdAt);
        case "name":
        default:
          return cmp(a.name, b.name);
      }
    });
    return list;
  }, [projects, query, sortKey, sortDir, lang]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!module || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module,
          name:
            newName.trim() ||
            (module === "invest"
              ? t("projects.defaultNameInvest")
              : module === "batches_wholesale"
                ? t("projects.defaultNameBatchesWholesale")
                : t("projects.defaultNameBatchesManufacturing")),
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const created = (await res.json()) as ProjectMeta;
      openProject({
        module,
        projectId: created.id,
        projectName: created.name,
      });
      router.push(MODULE_HOME[module]);
    } catch (error) {
      console.error(error);
      setCreating(false);
    }
  }

  function handleOpen(project: ProjectMeta) {
    if (!module) return;
    openProject({
      module,
      projectId: project.id,
      projectName: project.name,
    });
    router.push(MODULE_HOME[module]);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const project = deleteTarget;
    setBusyId(project.id);
    try {
      const res = await fetch(`/api/workspaces/${project.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      if (prefs.activeProjectId === project.id) {
        clearActiveProject();
      }
      await reload();
    } catch (error) {
      console.error(error);
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (!prefsReady || !module) {
    return (
      <p className="py-16 text-center text-[13px] text-muted">
        {t("common.loading")}
      </p>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[1180px] px-1 py-8 sm:py-10">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("projects.deleteTitle")}
        description={
          deleteTarget
            ? t("projects.deleteDescription", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
        onConfirm={() => {
          void confirmDelete();
        }}
      />

      <Link
        href="/"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft size={15} strokeWidth={2} aria-hidden />
        {t("projects.backToProducts")}
      </Link>

      <PageHeader
        title={`${productTitle} · ${t("projects.title")}`}
        description={t("projects.description")}
        action={
          <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
            <TextInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("projects.newNamePlaceholder")}
              maxLength={80}
              className="!w-[200px]"
            />
            <Button type="submit" disabled={creating} className="gap-1.5">
              <Plus size={15} strokeWidth={2} aria-hidden />
              {creating ? t("common.loading") : t("projects.create")}
            </Button>
          </form>
        }
      />

      <div className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("projects.searchPlaceholder")}
          className="!w-[260px] shrink-0"
        />
        <p className="ml-auto shrink-0 text-[12px] text-muted-soft">
          {t("projects.count", { count: rows.length })}
        </p>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[13px] text-muted">
          {t("common.loading")}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">
          {projects.length === 0 ? t("projects.empty") : t("projects.noFilterResults")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  <SortTh
                    label={t("projects.col.name")}
                    active={sortKey === "name"}
                    dir={sortDir}
                    onClick={() => toggleSort("name")}
                  />
                  <SortTh
                    label={t("projects.col.company")}
                    active={sortKey === "company"}
                    dir={sortDir}
                    onClick={() => toggleSort("company")}
                  />
                  <SortTh
                    label={t("projects.col.currency")}
                    active={sortKey === "currency"}
                    dir={sortDir}
                    onClick={() => toggleSort("currency")}
                  />
                  {isCosterraAppModule(module) ? (
                    <>
                      <SortTh
                        label={t("projects.col.batches")}
                        active={sortKey === "batches"}
                        dir={sortDir}
                        align="right"
                        onClick={() => toggleSort("batches")}
                      />
                      <SortTh
                        label={t("projects.col.products")}
                        active={sortKey === "products"}
                        dir={sortDir}
                        align="right"
                        onClick={() => toggleSort("products")}
                      />
                      <SortTh
                        label={t("projects.col.suppliers")}
                        active={sortKey === "suppliers"}
                        dir={sortDir}
                        align="right"
                        onClick={() => toggleSort("suppliers")}
                      />
                    </>
                  ) : (
                    <>
                      <SortTh
                        label={t("projects.col.overhead")}
                        active={sortKey === "overhead"}
                        dir={sortDir}
                        align="right"
                        onClick={() => toggleSort("overhead")}
                      />
                      <SortTh
                        label={t("projects.col.personnel")}
                        active={sortKey === "personnel"}
                        dir={sortDir}
                        align="right"
                        onClick={() => toggleSort("personnel")}
                      />
                      <SortTh
                        label={t("projects.col.cogs")}
                        active={sortKey === "cogs"}
                        dir={sortDir}
                        align="right"
                        onClick={() => toggleSort("cogs")}
                      />
                    </>
                  )}
                  <SortTh
                    label={t("projects.col.updated")}
                    active={sortKey === "updatedAt"}
                    dir={sortDir}
                    onClick={() => toggleSort("updatedAt")}
                  />
                  <th className="w-28 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((project) => (
                  <tr
                    key={project.id}
                    className="group border-b border-line last:border-0 hover:bg-surface-faint"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleOpen(project)}
                        className="text-left font-medium text-foreground hover:text-accent"
                      >
                        {project.name}
                      </button>
                      <p className="text-[11px] text-muted-soft">
                        {t("projects.createdAt", {
                          date: dateFmt.format(new Date(project.createdAt)),
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {project.companyName || t("common.emDash")}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {project.baseCurrency || t("common.emDash")}
                    </td>
                    {isCosterraAppModule(module) ? (
                      <>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {project.batchCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {project.productCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {project.supplierCount}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {project.overheadCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {project.personnelCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {project.cogsLineCount}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-muted">
                      {dateFmt.format(new Date(project.updatedAt))}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="secondary"
                          className="h-7 px-2 text-[12px]"
                          onClick={() => handleOpen(project)}
                          disabled={busyId === project.id}
                        >
                          {t("projects.open")}
                        </Button>
                        <Button
                          variant="danger"
                          className="h-7 min-w-7 px-2"
                          onClick={() => setDeleteTarget(project)}
                          disabled={busyId === project.id}
                          aria-label={t("projects.delete")}
                          title={t("projects.delete")}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "right";
}) {
  return (
    <th className="px-4 py-2.5 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          align === "right" ? "w-full justify-end" : ""
        } ${active ? "text-foreground" : ""}`}
      >
        {label}
        <span className="text-[10px] text-muted-soft">
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import type { PersonnelTeam } from "@/lib/types";
import { emptyPersonnelTeam } from "@/lib/personnel";
import { useI18n } from "@/hooks/useI18n";
import { PersonnelTeamFormModal } from "@/components/PersonnelTeamFormModal";
import {
  Button,
  ConfirmDialog,
  PageHeader,
  TableRowActions,
  TextInput,
} from "@/components/ui";

export default function TeamsPageClient() {
  const { ready, data, upsertPersonnelTeam, deletePersonnelTeam } = useStore();
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<PersonnelTeam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PersonnelTeam | null>(null);

  const roleCountByTeam = useMemo(() => {
    const map = new Map<string, number>();
    for (const role of data.personnelRoles ?? []) {
      if (!role.teamId) continue;
      map.set(role.teamId, (map.get(role.teamId) ?? 0) + 1);
    }
    return map;
  }, [data.personnelRoles]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(data.personnelTeams ?? [])]
      .filter((team) => {
        if (!q) return true;
        return (
          team.name.toLowerCase().includes(q) ||
          team.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [data.personnelTeams, query, lang]);

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const isEdit = Boolean(
    draft && (data.personnelTeams ?? []).some((t) => t.id === draft.id),
  );

  return (
    <div>
      <PageHeader
        title={t("teams.title")}
        description={t("teams.description")}
        action={
          <Button onClick={() => setDraft(emptyPersonnelTeam())}>
            {t("teams.add")}
          </Button>
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("teams.deleteTitle")}
        description={
          deleteTarget
            ? t("teams.deleteDescription", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
        onConfirm={() => {
          if (deleteTarget) deletePersonnelTeam(deleteTarget.id);
        }}
      />

      <PersonnelTeamFormModal
        open={Boolean(draft)}
        initial={draft}
        isEdit={isEdit}
        onClose={() => setDraft(null)}
        onSave={(team) => upsertPersonnelTeam(team)}
      />

      <div className="mb-4">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.search")}
          className="max-w-sm"
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line px-4 py-12 text-center">
          <p className="text-[14px] font-medium text-foreground">
            {t("teams.emptyTitle")}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">
            {t("teams.emptyDescription")}
          </p>
          <Button className="mt-4" onClick={() => setDraft(emptyPersonnelTeam())}>
            {t("teams.emptyCta")}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  <th className="px-4 py-2.5 font-medium">
                    {t("teams.col.name")}
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    {t("teams.col.notes")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("teams.col.roles")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">{t("common.edit")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((team) => (
                  <tr
                    key={team.id}
                    className="border-b border-line last:border-0 hover:bg-surface-faint"
                  >
                    <td className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => setDraft(structuredClone(team))}
                        className="text-left hover:text-accent"
                      >
                        {team.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {team.notes || t("common.emDash")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {roleCountByTeam.get(team.id) ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <TableRowActions
                        onEdit={() => setDraft(structuredClone(team))}
                        onDelete={() => setDeleteTarget(team)}
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
      )}

      <p className="mt-4 text-[12px] text-muted">
        {t("teams.hintToPersonnel")}{" "}
        <Link href="/overhead/personnel" className="text-accent hover:underline">
          {t("nav.overheadPersonnel")}
        </Link>
      </p>
    </div>
  );
}

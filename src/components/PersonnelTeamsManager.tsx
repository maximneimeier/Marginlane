"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { PersonnelTeam } from "@/lib/types";
import { emptyPersonnelTeam } from "@/lib/personnel";
import { useI18n } from "@/hooks/useI18n";
import { PersonnelTeamFormModal } from "@/components/PersonnelTeamFormModal";
import { Button, ConfirmDialog, TableRowActions } from "@/components/ui";

type Props = {
  /** Kompakte Variante für Einbettung (z. B. Firmen-Stammdaten) */
  compact?: boolean;
};

export function PersonnelTeamsManager({ compact = false }: Props) {
  const { data, upsertPersonnelTeam, deletePersonnelTeam } = useStore();
  const { t, lang } = useI18n();
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

  const rows = useMemo(
    () =>
      [...(data.personnelTeams ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, lang),
      ),
    [data.personnelTeams, lang],
  );

  const isEdit = Boolean(
    draft && (data.personnelTeams ?? []).some((team) => team.id === draft.id),
  );

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-foreground">
            {t("company.personnel.teamsTitle")}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {t("company.personnel.teamsHint")}
          </p>
        </div>
        <Button
          type="button"
          variant={compact ? "secondary" : "primary"}
          onClick={() => setDraft(emptyPersonnelTeam())}
        >
          {t("teams.add")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-line px-3 py-6 text-center">
          <p className="text-[13px] text-muted">{t("teams.emptyTitle")}</p>
          <Button
            className="mt-3"
            type="button"
            onClick={() => setDraft(emptyPersonnelTeam())}
          >
            {t("teams.emptyCta")}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-line">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                <th className="px-3 py-2 font-medium">{t("teams.col.name")}</th>
                <th className="px-3 py-2 font-medium">{t("teams.col.notes")}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("teams.col.roles")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
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
                  <td className="px-3 py-2.5 font-medium">
                    <button
                      type="button"
                      onClick={() => setDraft(structuredClone(team))}
                      className="text-left hover:text-accent"
                    >
                      {team.name}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    {team.notes || t("common.emDash")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {roleCountByTeam.get(team.id) ?? 0}
                  </td>
                  <td className="px-3 py-2.5">
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
      )}
    </div>
  );
}

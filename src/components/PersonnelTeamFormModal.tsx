"use client";

import { useEffect, useState } from "react";
import type { PersonnelTeam } from "@/lib/types";
import { emptyPersonnelTeam } from "@/lib/personnel";
import { useI18n } from "@/hooks/useI18n";
import { Button, Field, Modal, TextInput } from "@/components/ui";

type Props = {
  open: boolean;
  initial: PersonnelTeam | null;
  isEdit: boolean;
  onClose: () => void;
  onSave: (team: PersonnelTeam) => void;
};

export function PersonnelTeamFormModal({
  open,
  initial,
  isEdit,
  onClose,
  onSave,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<PersonnelTeam | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ? structuredClone(initial) : emptyPersonnelTeam());
  }, [open, initial]);

  if (!draft) return null;

  const canSave = draft.name.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEdit ? t("teams.modal.editTitle") : t("teams.modal.createTitle")
      }
      description={t("teams.modal.description")}
    >
      <div className="space-y-4">
        <Field label={t("teams.field.name")} required>
          <TextInput
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t("teams.field.namePlaceholder")}
          />
        </Field>
        <Field label={t("teams.field.notes")}>
          <TextInput
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder={t("teams.field.notesPlaceholder")}
          />
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              onSave({ ...draft, name: draft.name.trim() });
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

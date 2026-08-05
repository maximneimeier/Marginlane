"use client";

import { usePrefs, type AppLanguage } from "@/context/PreferencesContext";
import { useI18n } from "@/hooks/useI18n";
import { Button, Card, Field, PageHeader, Select, TextInput } from "@/components/ui";

export default function EinstellungenPage() {
  const { ready, prefs, setPrefs } = usePrefs();
  const { t } = useI18n();

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  return (
    <div>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <div className="space-y-4">
        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("settings.profile")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">{t("settings.profileHint")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("settings.displayName")}>
              <TextInput
                value={prefs.displayName}
                onChange={(e) => setPrefs({ displayName: e.target.value })}
                placeholder={t("settings.displayNamePlaceholder")}
              />
            </Field>
            <Field label={t("settings.email")}>
              <TextInput
                type="email"
                value={prefs.email}
                onChange={(e) => setPrefs({ email: e.target.value })}
                placeholder="name@firma.de"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("settings.language")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {t("settings.languageHint")}
          </p>
          <Field label={t("settings.appLanguage")}>
            <Select
              value={prefs.language}
              onChange={(e) =>
                setPrefs({ language: e.target.value as AppLanguage })
              }
              className="max-w-[240px]"
            >
              <option value="de">{t("settings.lang.de")}</option>
              <option value="en">{t("settings.lang.en")}</option>
            </Select>
          </Field>
          <p className="mt-3 text-[12px] text-muted-soft">
            {t("settings.savedLocally")}
          </p>
        </Card>

        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={() =>
              setPrefs({
                displayName: "Maxim Neimeier",
                email: "account@maximneimeier.de",
                language: "de",
              })
            }
          >
            {t("common.resetDefaults")}
          </Button>
        </div>
      </div>
    </div>
  );
}

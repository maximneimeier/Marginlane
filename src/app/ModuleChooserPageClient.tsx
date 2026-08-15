"use client";

import { useRouter } from "next/navigation";
import {
  Layers,
  LineChart,
} from "lucide-react";
import {
  MODULE_HOME,
  usePrefs,
  type AppModule,
} from "@/context/PreferencesContext";
import { useI18n } from "@/hooks/useI18n";

export default function ModuleChooserPageClient() {
  const { ready, setActiveModule } = usePrefs();
  const { t } = useI18n();
  const router = useRouter();

  function choose(module: AppModule) {
    setActiveModule(module);
    router.push(MODULE_HOME[module]);
  }

  if (!ready) {
    return (
      <p className="py-16 text-center text-[13px] text-muted">
        {t("common.loading")}
      </p>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center gap-8 py-8">
      <div className="text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">
          Marginlane
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground">
          {t("moduleChooser.title")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">
          {t("moduleChooser.description")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => choose("invest")}
          className="group rounded-[16px] border border-line bg-white p-6 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-accent hover:bg-surface-faint"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
            <LineChart size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="mt-4 text-[17px] font-semibold tracking-tight text-foreground">
            {t("moduleChooser.invest.title")}
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            {t("moduleChooser.invest.description")}
          </p>
          <p className="mt-4 text-[12px] font-medium text-accent group-hover:underline">
            {t("moduleChooser.invest.cta")} →
          </p>
        </button>

        <button
          type="button"
          onClick={() => choose("batches")}
          className="group rounded-[16px] border border-line bg-white p-6 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-accent hover:bg-surface-faint"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
            <Layers size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="mt-4 text-[17px] font-semibold tracking-tight text-foreground">
            {t("moduleChooser.batches.title")}
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            {t("moduleChooser.batches.description")}
          </p>
          <p className="mt-4 text-[12px] font-medium text-accent group-hover:underline">
            {t("moduleChooser.batches.cta")} →
          </p>
        </button>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { ArrowRight, Factory, Layers, LineChart } from "lucide-react";
import {
  MODULE_PROJECTS,
  type AppModule,
  usePrefs,
} from "@/context/PreferencesContext";
import { useI18n } from "@/hooks/useI18n";

export default function ModuleChooserPageClient() {
  const { t } = useI18n();
  const router = useRouter();
  const { setPrefs } = usePrefs();

  function choose(module: AppModule) {
    setPrefs({
      activeModule: module,
      activeProjectId: null,
      activeProjectName: null,
    });
    router.push(MODULE_PROJECTS[module]);
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-5xl flex-col justify-center px-1 py-10 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] rounded-[28px] bg-[radial-gradient(ellipse_at_top,_#edf3fe_0%,_transparent_58%),linear-gradient(180deg,_#f7f8fa_0%,_transparent_70%)]"
      />

      <div className="max-w-xl">
        <p className="text-[13px] font-semibold tracking-tight text-foreground">
          Atheniks
        </p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[40px]">
          {t("moduleChooser.title")}
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
          {t("moduleChooser.description")}
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ProductCard
          eyebrow={t("moduleChooser.invest.eyebrow")}
          title={t("moduleChooser.invest.title")}
          description={t("moduleChooser.invest.description")}
          cta={t("moduleChooser.invest.cta")}
          icon={<LineChart size={22} strokeWidth={1.7} aria-hidden />}
          onClick={() => choose("invest")}
        />
        <ProductCard
          eyebrow={t("moduleChooser.batchesWholesale.eyebrow")}
          title={t("moduleChooser.batchesWholesale.title")}
          description={t("moduleChooser.batchesWholesale.description")}
          cta={t("moduleChooser.batchesWholesale.cta")}
          icon={<Layers size={22} strokeWidth={1.7} aria-hidden />}
          onClick={() => choose("batches_wholesale")}
        />
        <ProductCard
          eyebrow={t("moduleChooser.batchesManufacturing.eyebrow")}
          title={t("moduleChooser.batchesManufacturing.title")}
          description={t("moduleChooser.batchesManufacturing.description")}
          cta={t("moduleChooser.batchesManufacturing.cta")}
          icon={<Factory size={22} strokeWidth={1.7} aria-hidden />}
          onClick={() => choose("batches")}
        />
      </div>
    </div>
  );
}

function ProductCard({
  eyebrow,
  title,
  description,
  cta,
  icon,
  onClick,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[220px] flex-col rounded-[18px] border border-line bg-white p-6 text-left shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#b8c9e8] hover:shadow-[0_12px_28px_rgba(28,29,31,0.06)] sm:p-7"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
        {icon}
      </span>
      <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.05em] text-muted">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">
        {description}
      </p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent">
        {cta}
        <ArrowRight
          size={15}
          strokeWidth={2}
          className="transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </button>
  );
}

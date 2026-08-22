"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppLanguage } from "@/lib/i18n";
import type { NumberFormatStyle } from "@/lib/types";
import {
  costerraModeFromModule,
  isCosterraAppModule,
  normalizeCosterraMode,
  type CosterraMode,
} from "@/lib/costerraMode";

export type { AppLanguage, CosterraMode };

/**
 * invest = Investa
 * batches = Costerra Fertigung
 * batches_wholesale = Costerra Handel (eigene Workspace-DB)
 */
export type AppModule = "invest" | "batches" | "batches_wholesale";

export type UserPrefs = {
  displayName: string;
  email: string;
  language: AppLanguage;
  /** Zahlenanzeige: DE 1.234,56 vs. US 1,234.56 */
  numberFormat: NumberFormatStyle;
  /** Aktives App-Modul; null = noch nicht gewählt */
  activeModule: AppModule | null;
  /**
   * Abgeleitet aus activeModule (batches_wholesale → wholesale).
   * Bleibt für UI-Kompatibilität gespeichert.
   */
  costerraMode: CosterraMode;
  /** Aktives Projekt (Workspace-ID); null = keines geöffnet */
  activeProjectId: string | null;
  /** Anzeigename des aktiven Projekts (Cache für Nav) */
  activeProjectName: string | null;
};

const STORAGE_KEY = "marginlane-prefs-v1";

const DEFAULT_PREFS: UserPrefs = {
  displayName: "Maxim Neimeier",
  email: "account@maximneimeier.de",
  language: "de",
  numberFormat: "de",
  activeModule: null,
  costerraMode: "wholesale",
  activeProjectId: null,
  activeProjectName: null,
};

type PrefsContextValue = {
  ready: boolean;
  prefs: UserPrefs;
  setPrefs: (patch: Partial<UserPrefs>) => void;
  setActiveModule: (module: AppModule | null) => void;
  openProject: (args: {
    module: AppModule;
    projectId: string;
    projectName: string;
  }) => void;
  clearActiveProject: () => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

function normalizeNumberFormat(value: unknown): NumberFormatStyle {
  return value === "en" ? "en" : "de";
}

function normalizeActiveModule(value: unknown): AppModule | null {
  if (
    value === "invest" ||
    value === "batches" ||
    value === "batches_wholesale"
  ) {
    return value;
  }
  return null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Alte Prefs: batches + wholesale → batches_wholesale (eigene DB). */
function migrateLoadedModule(
  module: AppModule | null,
  costerraMode: CosterraMode,
): {
  activeModule: AppModule | null;
  costerraMode: CosterraMode;
  clearProject: boolean;
} {
  if (module === "batches" && costerraMode === "wholesale") {
    return {
      activeModule: "batches_wholesale",
      costerraMode: "wholesale",
      clearProject: true,
    };
  }
  if (module === "batches_wholesale") {
    return {
      activeModule: module,
      costerraMode: "wholesale",
      clearProject: false,
    };
  }
  if (module === "batches") {
    return {
      activeModule: module,
      costerraMode: "manufacturing",
      clearProject: false,
    };
  }
  return {
    activeModule: module,
    costerraMode:
      module && isCosterraAppModule(module)
        ? costerraModeFromModule(module)
        : costerraMode,
    clearProject: false,
  };
}

function loadPrefs(): UserPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UserPrefs> & {
      costerraMode?: unknown;
    };
    const migrated = migrateLoadedModule(
      normalizeActiveModule(parsed.activeModule),
      normalizeCosterraMode(parsed.costerraMode),
    );
    return {
      displayName: parsed.displayName?.trim() || DEFAULT_PREFS.displayName,
      email: parsed.email?.trim() || DEFAULT_PREFS.email,
      language: parsed.language === "en" ? "en" : "de",
      numberFormat: normalizeNumberFormat(parsed.numberFormat),
      activeModule: migrated.activeModule,
      costerraMode: migrated.costerraMode,
      activeProjectId: migrated.clearProject
        ? null
        : normalizeOptionalString(parsed.activeProjectId),
      activeProjectName: migrated.clearProject
        ? null
        : normalizeOptionalString(parsed.activeProjectName),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function withSyncedCosterraMode(prefs: UserPrefs): UserPrefs {
  if (!isCosterraAppModule(prefs.activeModule)) return prefs;
  const mode = costerraModeFromModule(prefs.activeModule);
  if (prefs.costerraMode === mode) return prefs;
  return { ...prefs, costerraMode: mode };
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<UserPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefsState(loadPrefs());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = prefs.language;
  }, [ready, prefs.language]);

  const setPrefs = useCallback((patch: Partial<UserPrefs>) => {
    setPrefsState((prev) => {
      const nextModule =
        patch.activeModule !== undefined
          ? normalizeActiveModule(patch.activeModule)
          : prev.activeModule;

      let next: UserPrefs = {
        displayName:
          patch.displayName !== undefined
            ? patch.displayName
            : prev.displayName,
        email: patch.email !== undefined ? patch.email : prev.email,
        language:
          patch.language === "en"
            ? "en"
            : patch.language === "de"
              ? "de"
              : prev.language,
        numberFormat:
          patch.numberFormat !== undefined
            ? normalizeNumberFormat(patch.numberFormat)
            : prev.numberFormat,
        activeModule: nextModule,
        costerraMode:
          patch.costerraMode !== undefined
            ? normalizeCosterraMode(patch.costerraMode)
            : prev.costerraMode,
        activeProjectId:
          patch.activeProjectId !== undefined
            ? normalizeOptionalString(patch.activeProjectId)
            : prev.activeProjectId,
        activeProjectName:
          patch.activeProjectName !== undefined
            ? normalizeOptionalString(patch.activeProjectName)
            : prev.activeProjectName,
      };
      next = withSyncedCosterraMode(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setActiveModule = useCallback(
    (module: AppModule | null) => {
      setPrefs({ activeModule: module });
    },
    [setPrefs],
  );

  const openProject = useCallback(
    (args: {
      module: AppModule;
      projectId: string;
      projectName: string;
    }) => {
      setPrefs({
        activeModule: args.module,
        activeProjectId: args.projectId,
        activeProjectName: args.projectName,
      });
    },
    [setPrefs],
  );

  const clearActiveProject = useCallback(() => {
    setPrefs({ activeProjectId: null, activeProjectName: null });
  }, [setPrefs]);

  const value = useMemo(
    () => ({
      ready,
      prefs,
      setPrefs,
      setActiveModule,
      openProject,
      clearActiveProject,
    }),
    [ready, prefs, setPrefs, setActiveModule, openProject, clearActiveProject],
  );

  return (
    <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
  );
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PreferencesProvider");
  return ctx;
}

export function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const MODULE_HOME: Record<AppModule, string> = {
  invest: "/revenue",
  batches: "/batches",
  batches_wholesale: "/batches",
};

export const MODULE_PROJECTS: Record<AppModule, string> = {
  invest: "/projects/invest",
  batches: "/projects/batches",
  batches_wholesale: "/projects/batches_wholesale",
};

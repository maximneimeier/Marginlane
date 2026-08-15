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

export type { AppLanguage };

export type AppModule = "invest" | "batches";

export type UserPrefs = {
  displayName: string;
  email: string;
  language: AppLanguage;
  /** Zahlenanzeige: DE 1.234,56 vs. US 1,234.56 */
  numberFormat: NumberFormatStyle;
  /** Aktives App-Modul; null = noch nicht gewählt */
  activeModule: AppModule | null;
};

const STORAGE_KEY = "marginlane-prefs-v1";

const DEFAULT_PREFS: UserPrefs = {
  displayName: "Maxim Neimeier",
  email: "account@maximneimeier.de",
  language: "de",
  numberFormat: "de",
  activeModule: null,
};

type PrefsContextValue = {
  ready: boolean;
  prefs: UserPrefs;
  setPrefs: (patch: Partial<UserPrefs>) => void;
  setActiveModule: (module: AppModule | null) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

function normalizeNumberFormat(value: unknown): NumberFormatStyle {
  return value === "en" ? "en" : "de";
}

function normalizeActiveModule(value: unknown): AppModule | null {
  if (value === "invest" || value === "batches") return value;
  return null;
}

function loadPrefs(): UserPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    return {
      displayName: parsed.displayName?.trim() || DEFAULT_PREFS.displayName,
      email: parsed.email?.trim() || DEFAULT_PREFS.email,
      language: parsed.language === "en" ? "en" : "de",
      numberFormat: normalizeNumberFormat(parsed.numberFormat),
      activeModule: normalizeActiveModule(parsed.activeModule),
    };
  } catch {
    return DEFAULT_PREFS;
  }
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
      const next: UserPrefs = {
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
        activeModule:
          patch.activeModule !== undefined
            ? normalizeActiveModule(patch.activeModule)
            : prev.activeModule,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setActiveModule = useCallback((module: AppModule | null) => {
    setPrefs({ activeModule: module });
  }, [setPrefs]);

  const value = useMemo(
    () => ({ ready, prefs, setPrefs, setActiveModule }),
    [ready, prefs, setPrefs, setActiveModule],
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
  if (parts.length === 0) return "ML";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const MODULE_HOME: Record<AppModule, string> = {
  invest: "/revenue",
  batches: "/batches",
};

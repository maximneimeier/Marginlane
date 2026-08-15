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

export type UserPrefs = {
  displayName: string;
  email: string;
  language: AppLanguage;
  /** Zahlenanzeige: DE 1.234,56 vs. US 1,234.56 */
  numberFormat: NumberFormatStyle;
};

const STORAGE_KEY = "marginlane-prefs-v1";

const DEFAULT_PREFS: UserPrefs = {
  displayName: "Maxim Neimeier",
  email: "account@maximneimeier.de",
  language: "de",
  numberFormat: "de",
};

type PrefsContextValue = {
  ready: boolean;
  prefs: UserPrefs;
  setPrefs: (patch: Partial<UserPrefs>) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

function normalizeNumberFormat(value: unknown): NumberFormatStyle {
  return value === "en" ? "en" : "de";
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
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ ready, prefs, setPrefs }),
    [ready, prefs, setPrefs],
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
